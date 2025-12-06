/*!
 * Copyright (c) 2025 Clevo Control Center Contributors
 *
 * This file is part of Clevo Control Center.
 *
 * This is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { ITccFanProfile, ITccFanTableEntry, FanTransitionMode, MIN_FAN_POINTS, MAX_FAN_POINTS } from 'src/common/models/TccFanTable';

@Component({
    selector: 'app-fan-curve-editor',
    templateUrl: './fan-curve-editor.component.html',
    styleUrls: ['./fan-curve-editor.component.scss']
})
export class FanCurveEditorComponent implements OnInit {
    @Input() fanType: 'cpu' | 'gpu' = 'cpu';
    @Input() fanProfile: ITccFanProfile;
    @Output() profileChange = new EventEmitter<ITccFanProfile>();
    
    public points: ITccFanTableEntry[] = [];
    public transitionMode: FanTransitionMode = FanTransitionMode.SMOOTH;
    public minPoints = MIN_FAN_POINTS;
    public maxPoints = MAX_FAN_POINTS;
    public FanTransitionMode = FanTransitionMode;
    
    ngOnInit() {
        this.loadProfile();
    }
    
    private loadProfile() {
        if (!this.fanProfile) return;
        
        if (this.fanType === 'cpu') {
            this.points = [...(this.fanProfile.tableCPU || [])];
            this.transitionMode = this.fanProfile.cpuTransitionMode || FanTransitionMode.SMOOTH;
        } else {
            this.points = [...(this.fanProfile.tableGPU || [])];
            this.transitionMode = this.fanProfile.gpuTransitionMode || FanTransitionMode.SMOOTH;
        }
        
        if (this.points.length === 0) {
            this.points = [{ temp: 50, speed: 50 }];
        }
    }
    
    public addPoint() {
        if (this.points.length >= this.maxPoints) return;
        
        let newTemp = 50;
        if (this.points.length > 0) {
            const lastPoint = this.points[this.points.length - 1];
            newTemp = Math.min(100, lastPoint.temp + 10);
        }
        
        this.points.push({ temp: newTemp, speed: 50 });
        this.sortPoints();
        this.emitChanges();
    }
    
    public removePoint(index: number) {
        if (this.points.length <= this.minPoints) return;
        this.points.splice(index, 1);
        this.emitChanges();
    }
    
    public onTempChange(index: number) {
        this.points[index].temp = Math.max(0, Math.min(100, this.points[index].temp));
        this.sortPoints();
        this.emitChanges();
    }
    
    public onSpeedChange(index: number) {
        this.points[index].speed = Math.max(0, Math.min(100, this.points[index].speed));
        this.emitChanges();
    }
    
    public onTransitionModeChange() {
        this.emitChanges();
    }
    
    private sortPoints() {
        this.points.sort((a, b) => a.temp - b.temp);
    }
    
    private emitChanges() {
        const updatedProfile = { ...this.fanProfile };
        
        if (this.fanType === 'cpu') {
            updatedProfile.tableCPU = [...this.points];
            updatedProfile.cpuTransitionMode = this.transitionMode;
        } else {
            updatedProfile.tableGPU = [...this.points];
            updatedProfile.gpuTransitionMode = this.transitionMode;
        }
        
        this.profileChange.emit(updatedProfile);
    }
    
    public copyFromOtherFan() {
        const sourceFanType = this.fanType === 'cpu' ? 'gpu' : 'cpu';
        const sourceTable = sourceFanType === 'cpu' ? this.fanProfile.tableCPU : this.fanProfile.tableGPU;
        const sourceMode = sourceFanType === 'cpu' ? this.fanProfile.cpuTransitionMode : this.fanProfile.gpuTransitionMode;
        
        if (sourceTable) {
            this.points = JSON.parse(JSON.stringify(sourceTable));
            this.transitionMode = sourceMode || FanTransitionMode.SMOOTH;
            this.emitChanges();
        }
    }
}