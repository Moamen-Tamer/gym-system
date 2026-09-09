import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

export interface KpiCard {
  title: string;
  value: string;
  detail: string;
  subDetail?: string;
  accent: string;
  icon: string;
}

export interface StatisticsResponse {
  kpiCards: KpiCard[];
  volumeData: { label: string; height: number; complete?: boolean; isHighest?: boolean }[];
  disciplines: { name: string; percentage: number; color: string }[];
  muscleGroups: {
    name: string;
    status: string;
    volume: string;
    progress: number;
    rating: string;
    color: string;
  }[];
  hrZones: { zone: string; range: string; percentage: number; duration: string; color: string }[];
  milestones: {
    title: string;
    weight: string;
    delta: string;
    date: string;
    progress: number;
    tag: string;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  getStatisticsData(range: string): Observable<StatisticsResponse> {
    return of(this.createMockData());
  }

  normalizeResponse(data: StatisticsResponse): StatisticsResponse {
    return data;
  }

  createMockData(): StatisticsResponse {
    return {
      kpiCards: [
        {
          title: 'PEAK 1RM STRENGTH TREND',
          value: '+8.4%',
          detail: 'Across compound lifts',
          accent: 'lime',
          icon: 'assets/icons/Peak.svg',
        },
        {
          title: 'WEEKLY CONSISTENCY',
          value: '94%',
          detail: '4-5 Target',
          subDetail: '18 Consecutive Weeks',
          accent: 'white',
          icon: 'assets/icons/True-sign.svg',
        },
        {
          title: 'AVG HEART RATE / ZONE',
          value: '154',
          detail: 'Peak Zone 4 (Threshold)',
          subDetail: '38% Total',
          accent: 'white',
          icon: 'assets/icons/Heart-rate.svg',
        },
        {
          title: 'VOLUME DISTRIBUTION DAY',
          value: 'Tuesday',
          detail: '34% Peak Volume',
          subDetail: 'Sunday (Scheduled Rest)',
          accent: 'white',
          icon: 'assets/icons/calender.svg',
        },
      ],
      volumeData: [
        { label: 'W01', height: 40 },
        { label: 'W02', height: 45 },
        { label: 'W03', height: 50 },
        { label: 'W04', height: 35 },
        { label: 'W05', height: 55 },
        { label: 'W06', height: 40 },
        { label: 'W07', height: 60 },
        { label: 'W08', height: 50 },
        { label: 'W09', height: 65 },
        { label: 'W10', height: 70 },
        { label: 'W11', height: 88, complete: true, isHighest: true },
        { label: 'W12', height: 95, complete: true },
      ],
      disciplines: [
        { name: 'Strength & Heavy Lifts', percentage: 48, color: '#caff00' },
        { name: 'HIIT & Conditioning', percentage: 26, color: '#ff8a00' },
        { name: 'Mobility & Recovery', percentage: 14, color: '#00df85' },
        { name: 'Endurance / Low-Zone Cardio', percentage: 12, color: '#555555' },
      ],
      muscleGroups: [
        {
          name: 'Chest & Anterior Deltoids',
          status: 'Optimal',
          volume: '24 Sets • 92% Intensity',
          rating: '4.8 / 5.0',
          progress: 92,
          color: '#caff00',
        },
        {
          name: 'Back & Latissimus Dorsi',
          status: 'Optimal',
          volume: '28 Sets • 96% Intensity',
          rating: '4.9 / 5.0',
          progress: 96,
          color: '#caff00',
        },
        {
          name: 'Quads, Glutes & Hamstrings',
          status: 'High Fatigue',
          volume: '32 Sets • 98% Intensity',
          rating: '5.0 / 5.0',
          progress: 98,
          color: '#ff8a00',
        },
        {
          name: 'Biceps, Triceps & Forearms',
          status: 'Moderate',
          volume: '16 Sets • 74% Intensity',
          rating: '3.7 / 5.0',
          progress: 74,
          color: '#777777',
        },
        {
          name: 'Core & Trunk Stabilizers',
          status: 'Balanced',
          volume: '14 Sets • 68% Intensity',
          rating: '3.4 / 5.0',
          progress: 68,
          color: '#00df85',
        },
      ],
      hrZones: [
        {
          zone: 'Zone 5: Max Output (>176 BPM)',
          range: '',
          percentage: 10,
          duration: '42 mins',
          color: '#ff4d4d',
        },
        {
          zone: 'Zone 4: Anaerobic Threshold (160-175 BPM)',
          range: '',
          percentage: 28,
          duration: '1 hr 58 mins',
          color: '#ff8a00',
        },
        {
          zone: 'Zone 3: Aerobic Capacity (142-159 BPM)',
          range: '',
          percentage: 26,
          duration: '1 hr 50 mins',
          color: '#caff00',
        },
        {
          zone: 'Zone 2: Endurance Base (120-141 BPM)',
          range: '',
          percentage: 22,
          duration: '1 hr 32 mins',
          color: '#00df85',
        },
        {
          zone: 'Zone 1: Active Recovery (<120 BPM)',
          range: '',
          percentage: 14,
          duration: '58 mins',
          color: '#444444',
        },
      ],
      milestones: [
        {
          title: 'CONVENTIONAL DEADLIFT',
          weight: '445',
          delta: '+25 lbs delta',
          date: 'Set 2 weeks ago',
          progress: 95,
          tag: 'New PR',
        },
        {
          title: 'BARBELL BENCH PRESS',
          weight: '315',
          delta: '+10 lbs delta',
          date: 'Set 1 month ago',
          progress: 85,
          tag: 'Established',
        },
        {
          title: 'HIGH-BAR BACK SQUAT',
          weight: '405',
          delta: '+15 lbs delta',
          date: 'Set 3 weeks ago',
          progress: 90,
          tag: 'New PR',
        },
        {
          title: 'WEIGHTED PULL-UP',
          weight: '+80',
          delta: '+8 lbs delta',
          date: 'Set 5 weeks ago',
          progress: 80,
          tag: 'Established',
        },
      ],
    };
  }
}
