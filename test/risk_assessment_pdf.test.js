// @purpose: Tests cho Dynamic JSA/HSE Risk Assessment Matrix & PDF Branding/Watermark (Trial do dam vs Pro thanh manh)
import { describe, it, expect } from 'vitest';
import { LiftPlanModel } from '../src/core/LiftPlanModel.js';
import {
  getAuthorAttributionText,
  evaluateLiveRiskMatrix,
  buildPdfBrandingChrome
} from '../src/core/RiskAssessmentReport.js';

describe('JSA / HSE Risk Assessment Matrix & PDF Anti-Theft Watermark', () => {
  it('evaluates all 5 live engineering hazard factors dynamically', () => {
    const lowRiskPlan = new LiftPlanModel({
      windSpeedMps: 3.0,
      groundBearingKpa: 110,
      inspectionStatus: 'VALID',
      cogOffsetM: { x: 0.02, y: 0, z: 0.01 },
      topBridle: { slingAngleDeg: 60 }
    });
    const lowMatrix = evaluateLiveRiskMatrix(lowRiskPlan);
    expect(lowMatrix.items.length).toBe(5);
    expect(lowMatrix.overallRisk).toBe('LOW');

    const hazardPlan = new LiftPlanModel({
      windSpeedMps: 15.0,
      groundBearingKpa: 380,
      inspectionStatus: 'EXPIRED',
      cogOffsetM: { x: 0.7, y: 0, z: 0.1 },
      topBridle: { slingAngleDeg: 28 }
    });
    const highMatrix = evaluateLiveRiskMatrix(hazardPlan);
    expect(highMatrix.overallRisk).toBe('CRITICAL');
    expect(highMatrix.items.every((i) => i.riskLevel === 'CRITICAL')).toBe(true);
  });

  it('builds heavy red Trial watermark vs subtle Pro watermark and includes full author attribution', () => {
    const attr = getAuthorAttributionText();
    expect(attr).toContain('safelift3d.com');
    expect(attr).toContain('Lê Việt Phương');
    expect(attr).toContain('levietphuong.hcmutrans@gmail.com');
    expect(attr).toContain('+84 968 051 697');

    const trialChrome = buildPdfBrandingChrome({ isTrialActive: true, isProUser: false });
    expect(trialChrome.watermarkHtml).toContain('TRIAL VERSION');
    expect(trialChrome.css).toContain('rgba(220, 38, 38');

    const proChrome = buildPdfBrandingChrome({ isTrialActive: false, isProUser: true });
    expect(proChrome.watermarkHtml).toContain('AUTHORIZED PRO LICENSE');
    expect(proChrome.css).toContain('rgba(56, 189, 248');
  });

  it('injects JSA/HSE Risk Assessment page & license watermark cleanly into LiftPlanModel printable HTML', () => {
    const plan = new LiftPlanModel({
      windSpeedMps: 11.5,
      topBridle: { slingAngleDeg: 40 }
    });
    const trialHtml = plan.generatePrintableHTML(null, { isTrialActive: true, isProUser: false });
    expect(trialHtml).toContain('jsa-hse-risk-page');
    expect(trialHtml).toContain('TRIAL VERSION');
    expect(trialHtml).toContain('levietphuong.hcmutrans@gmail.com');

    const proHtml = plan.generatePrintableHTML(null, { isTrialActive: false, isProUser: true });
    expect(proHtml).toContain('AUTHORIZED PRO LICENSE');
    expect(proHtml).toContain('INTEGRATED JSA / HSE RISK ASSESSMENT MATRIX');
  });
});
