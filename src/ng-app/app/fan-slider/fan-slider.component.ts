/*!
 * Copyright (c) 2019-2023 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
 *
 * This file is part of TUXEDO Control Center.
 *
 * TUXEDO Control Center is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TUXEDO Control Center is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TUXEDO Control Center.  If not, see <https://www.gnu.org/licenses/>.
 */
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import {
    AbstractControl,
    FormBuilder,
    FormGroup,
    Validators,
} from "@angular/forms";
import { Mutex } from "async-mutex";
import {
    ITccFanProfile,
    ITccFanTableEntry,
    customFanPreset,
    MIN_FAN_POINTS,
    MAX_FAN_POINTS,
} from "src/common/models/TccFanTable";
import {
    fantableDatasets,
    graphColors,
    graphOptions,
} from "src/common/classes/FanChartProperties";
import { Color, Label } from "ng2-charts";
import { ChartDataSets, ChartOptions } from "chart.js";
import {
    interpolatePointsArray,
    manageCriticalTemperature,
} from "src/common/classes/FanUtils";
import { delay } from "src/common/classes/Utils";
import { formatTemp } from "../../../common/classes/FanUtils";
import { ConfigService } from "../config.service";
import { UtilsService } from "../utils.service";
@Component({
    selector: "app-fan-slider",
    templateUrl: "./fan-slider.component.html",
    styleUrls: ["./fan-slider.component.scss"],
})
export class FanSliderComponent implements OnInit {
    public customFanPreset = customFanPreset;

    @Input()
    public customFanCurve: ITccFanProfile;

    @Output()
    public setSliderDirty = new EventEmitter<void>();

    @Output()
    public customFanCurveEvent = new EventEmitter<ITccFanProfile>();

    @Output()
    public chartToggleEvent = new EventEmitter<boolean>();

    @Input()
    public tempCustomFanCurve: ITccFanProfile;

    public fanFormGroupCPU: FormGroup;
    public fanFormGroupGPU: FormGroup;

    @Input()
    public showFanGraphs: boolean = false;

    // Separate fan curves for CPU and GPU
    public cpuFanPoints: ITccFanTableEntry[] = [];
    public gpuFanPoints: ITccFanTableEntry[] = [];

    // Constants for template access
    public MIN_FAN_POINTS = MIN_FAN_POINTS;
    public MAX_FAN_POINTS = MAX_FAN_POINTS;

    public activeFanType: 'CPU' | 'GPU' = 'CPU';

    private mutex = new Mutex();
    public tempsLabels: Label[] = Array.from(Array(100).keys())
    .concat(100)
    .map((e) => formatTemp(e, this.config.getSettings().fahrenheit));;
    public graphOptions: ChartOptions = graphOptions;
    public fantableDatasets: ChartDataSets[] = fantableDatasets;
    public graphColors: Color[] = graphColors;
    public graphType = "line";

    constructor(
        private fb: FormBuilder,       
        private config: ConfigService, 
        private utils: UtilsService,
        ) {}
        
    public ngOnInit(): void {
        this.initFanFormGroups();
        this.updateFanChartDataset();
    }

    private initFanFormGroups(): void {
        const fanCurve = this.tempCustomFanCurve || this.customFanCurve;

        // Initialize CPU fan points
        this.cpuFanPoints = fanCurve.tableCPU ? [...fanCurve.tableCPU] : [...customFanPreset.tableCPU];
        const cpuInitialValues = this.cpuFanPoints.reduce(
            (acc, { temp, speed }) => {
                return { ...acc, ...{ [`${temp}c`]: speed } };
            },
            {}
        );
        this.fanFormGroupCPU = this.fb.group(cpuInitialValues);

        // Initialize GPU fan points
        this.gpuFanPoints = fanCurve.tableGPU ? [...fanCurve.tableGPU] : [...customFanPreset.tableGPU];
        const gpuInitialValues = this.gpuFanPoints.reduce(
            (acc, { temp, speed }) => {
                return { ...acc, ...{ [`${temp}c`]: speed } };
            },
            {}
        );
        this.fanFormGroupGPU = this.fb.group(gpuInitialValues);
    }

    public patchFanFormGroup(ac: AbstractControl): void {
        // Patch both CPU and GPU form groups if values exist
        if (ac.value.tableCPU) {
            ac.value.tableCPU.forEach(({ temp, speed }) => {
                if (this.fanFormGroupCPU.controls[`${temp}c`]) {
                    this.fanFormGroupCPU.controls[`${temp}c`].setValue(speed);
                }
            });
        }
        if (ac.value.tableGPU) {
            ac.value.tableGPU.forEach(({ temp, speed }) => {
                if (this.fanFormGroupGPU.controls[`${temp}c`]) {
                    this.fanFormGroupGPU.controls[`${temp}c`].setValue(speed);
                }
            });
        }
        this.updateFanChartDataset();
    }

    public getFanFormGroupValues(): ITccFanProfile {
        const tableCPU = this.cpuFanPoints.map(({ temp }) => ({
            temp,
            speed: this.fanFormGroupCPU.get(`${temp}c`).value,
        }));
        const tableGPU = this.gpuFanPoints.map(({ temp }) => ({
            temp,
            speed: this.fanFormGroupGPU.get(`${temp}c`).value,
        }));
        return {
            tableCPU,
            tableGPU
        };
    }

    private setFormValue(temp: number, sliderValue: number, fanType: 'CPU' | 'GPU'): void {
        if (fanType === 'CPU') {
            this.fanFormGroupCPU.patchValue({
                [`${temp}c`]: sliderValue,
            });
        } else {
            this.fanFormGroupGPU.patchValue({
                [`${temp}c`]: sliderValue,
            });
        }
    }


    formatTemperatureLabel(temp: number) {
        if(this.config.getSettings().fahrenheit) {
            temp = Math.round(this.utils.getFahrenheitFromCelsius(temp));
            return temp.toString() + " °F";
        }   
        else {
            return temp.toString() + " °C";
        }
    }

    public async adjustSliderValues(
        sliderValue: number,
        temp: number,
        fanType: 'CPU' | 'GPU'
    ): Promise<void> {
        await this.mutex.runExclusive(async () => {
            const clampedSliderValue = manageCriticalTemperature(
                temp,
                sliderValue
            );
            const leftSliders = this.getSlidersToAdjust(temp, "left", fanType);
            const rightSliders = this.getSlidersToAdjust(temp, "right", fanType);

            this.adjustSliders(leftSliders, clampedSliderValue, temp, "left", fanType);
            this.adjustSliders(rightSliders, clampedSliderValue, temp, "right", fanType);

            // slider won't adjust to formgroup value without delay
            await delay(10);
            this.setFormValue(temp, clampedSliderValue, fanType);
            this.updateFanChartDataset();
        });
    }

    private getSlidersToAdjust(
        temp: number,
        direction: "left" | "right",
        fanType: 'CPU' | 'GPU'
    ): number[] {
        const points = fanType === 'CPU' ? this.cpuFanPoints : this.gpuFanPoints;
        return points
            .filter((entry: ITccFanTableEntry) =>
                direction === 'left' ? entry.temp < temp : entry.temp > temp
            )
            .map((entry) => entry.temp);
    }

    private adjustSliders(
        sliders: number[],
        sliderValue: number,
        temp: number,
        direction: "left" | "right",
        fanType: 'CPU' | 'GPU'
    ): void {
        const targetValue = manageCriticalTemperature(temp, sliderValue);
        const formGroup = fanType === 'CPU' ? this.fanFormGroupCPU : this.fanFormGroupGPU;

        for (const slider of sliders) {
            const sliderControl = formGroup.get(`${slider}c`);
            if (!sliderControl) continue;
            const sliderControlValue = sliderControl.value;

            if (
                (direction === "left" && sliderControlValue > sliderValue) ||
                (direction === "right" && sliderControlValue < sliderValue)
            ) {
                sliderControl.setValue(targetValue);
            }
        }
    }

    public async updateComponents(sliderValue: number, temp: number, fanType: 'CPU' | 'GPU') {
        await this.adjustSliderValues(sliderValue, temp, fanType);
    }

    public dirtyFanFormGroup() {
        this.setSliderDirty.emit();
    }

    public updateFanChartDataset() {
        let { tableCPU, tableGPU } = this.getFanFormGroupValues();

        this.fantableDatasets[0].data = interpolatePointsArray(tableCPU);
        this.fantableDatasets[1].data = interpolatePointsArray(tableGPU);
    }

    public toggleFanGraphs() {
        this.updateFanChartDataset();
        const canvas = document.getElementById("hidden");
        this.showFanGraphs = !this.showFanGraphs;
        if (canvas) {
            canvas.style.display = this.showFanGraphs ? "flex" : "none";
        }
    }

    public addFanPoint(fanType: 'CPU' | 'GPU'): void {
        const points = fanType === 'CPU' ? this.cpuFanPoints : this.gpuFanPoints;
        if (points.length >= MAX_FAN_POINTS) {
            console.warn(`Cannot add more points: maximum of ${MAX_FAN_POINTS} points reached for ${fanType}`);
            return;
        }

        let newTemp: number;
        let newSpeed: number;
        let insertIndex: number;

        if (points.length === 0) {
            // Edge case: no points exist yet
            newTemp = 50;
            newSpeed = 50;
            insertIndex = 0;
        } else if (points.length === 1) {
            // Special case: only one point exists
            // Add a point either before or after based on where there's more room
            const singlePoint = points[0];
            if (singlePoint.temp < 50) {
                // Add point after
                newTemp = Math.min(100, singlePoint.temp + 50);
                insertIndex = 1;
            } else {
                // Add point before
                newTemp = Math.max(0, singlePoint.temp - 50);
                insertIndex = 0;
            }
            newSpeed = singlePoint.speed;
        } else {
            // Find the largest gap between consecutive points
            // Also consider gaps before first point and after last point
            let maxGap = 0;
            insertIndex = 1;
            
            // Check gap before first point (0 to first point)
            const firstGap = points[0].temp - 0;
            if (firstGap > maxGap) {
                maxGap = firstGap;
                insertIndex = 0;
            }
            
            // Check gaps between consecutive points
            for (let i = 0; i < points.length - 1; i++) {
                const gap = points[i + 1].temp - points[i].temp;
                if (gap > maxGap) {
                    maxGap = gap;
                    insertIndex = i + 1;
                }
            }
            
            // Check gap after last point (last point to 100)
            const lastGap = 100 - points[points.length - 1].temp;
            if (lastGap > maxGap) {
                maxGap = lastGap;
                insertIndex = points.length;
            }
            
            // Calculate new temperature as midpoint of the largest gap
            let prevTemp: number;
            let nextTemp: number;
            let prevSpeed: number;
            let nextSpeed: number;
            
            if (insertIndex === 0) {
                // Inserting before first point
                prevTemp = 0;
                nextTemp = points[0].temp;
                prevSpeed = points[0].speed;
                nextSpeed = points[0].speed;
            } else if (insertIndex === points.length) {
                // Inserting after last point
                prevTemp = points[points.length - 1].temp;
                nextTemp = 100;
                prevSpeed = points[points.length - 1].speed;
                nextSpeed = points[points.length - 1].speed;
            } else {
                // Inserting between two points
                prevTemp = points[insertIndex - 1].temp;
                nextTemp = points[insertIndex].temp;
                prevSpeed = points[insertIndex - 1].speed;
                nextSpeed = points[insertIndex].speed;
            }
            
            newTemp = Math.round((prevTemp + nextTemp) / 2);
            
            // If the gap is too small (temps would be identical), we can't add a point
            if (newTemp === prevTemp || newTemp === nextTemp) {
                console.warn(`Cannot add point: no valid temperature gap available for ${fanType}`);
                return;
            }
            
            // Interpolate speed for the new point
            newSpeed = Math.round((prevSpeed + nextSpeed) / 2);
        }

        const newPoint = { temp: newTemp, speed: newSpeed };
        points.splice(insertIndex, 0, newPoint);

        // Re-init form groups to include the new point
        this.reinitFormGroup(fanType);
        this.dirtyFanFormGroup();
        this.updateFanChartDataset();
    }

    public removeFanPoint(fanType: 'CPU' | 'GPU', index: number): void {
        const points = fanType === 'CPU' ? this.cpuFanPoints : this.gpuFanPoints;
        if (points.length <= MIN_FAN_POINTS) {
            return;
        }

        points.splice(index, 1);
        this.reinitFormGroup(fanType);
        this.dirtyFanFormGroup();
        this.updateFanChartDataset();
    }

    private reinitFormGroup(fanType: 'CPU' | 'GPU'): void {
        const points = fanType === 'CPU' ? this.cpuFanPoints : this.gpuFanPoints;
        const initialValues = points.reduce(
            (acc, { temp, speed }) => {
                return { ...acc, ...{ [`${temp}c`]: speed } };
            },
            {}
        );

        if (fanType === 'CPU') {
            this.fanFormGroupCPU = this.fb.group(initialValues);
        } else {
            this.fanFormGroupGPU = this.fb.group(initialValues);
        }
    }

    public setActiveFanType(fanType: 'CPU' | 'GPU'): void {
        this.activeFanType = fanType;
    }

    public ngOnDestroy() {
        this.customFanCurveEvent.emit(this.getFanFormGroupValues());
        this.chartToggleEvent.emit(this.showFanGraphs);
    }
}
