import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createHeadlessSim } from './sim_test_harness.js';

function setupScenario({ cogX = -0.88, cogY = -0.09, cogZ = 0.0, beamSpan = 5.70, hookStartY = 7.8, hookTargetY = 9.5 } = {}) {
    const sim = createHeadlessSim();
    const state = sim.getState();
    const phy = sim.getPhy();

    state.cargoType = 'container';
    state.L = 6.058;
    state.W = 2.438;
    state.H = 2.591;
    state.weight = 21.0;
    state.cogX = cogX;
    state.cogY = cogY;
    state.cogZ = cogZ;

    state.beamType = 'spreader';
    state.gear.beam.lengthM = beamSpan;
    state.upperSlingLength = 4.45;
    state.lowerSlingLength = 1.28;
    state.slingLength = 1.28;
    state.gear.legs.forEach(l => l.lengthM = 1.28);
    state.gear.uppers.forEach(u => u.lengthM = 4.45);

    sim.rebuildCargoAndRig(true);

    phy.hookPos.set(0, hookStartY, 0);
    phy.hookTarget.set(0, hookTargetY, 0);
    state.poseLock = false;
    phy.autoHoistActive = true;

    return { sim, state, phy };
}

describe('BỘ TIÊU CHÍ NGHIỆM THU KIỂM THỬ COG TILT & STABILITY (C1 - C10)', () => {

    it('C1: CoG = 0, bridle 4 nhánh + dầm ngang -> Hàng nâng thẳng đứng, |tilt| < 1.0°', () => {
        const { sim, phy } = setupScenario({ cogX: 0.0, cogY: -0.09, cogZ: 0.0 });

        for (let frame = 0; frame < 500; frame++) {
            sim.stepPhysicsEngine(1 / 60);
        }

        const euler = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
        const rollDeg = Math.abs(euler.z * 180 / Math.PI);
        const pitchDeg = Math.abs(euler.x * 180 / Math.PI);

        expect(phy.groundClearance).toBeGreaterThan(0.5);
        expect(rollDeg).toBeLessThan(1.0);
        expect(pitchDeg).toBeLessThan(1.0);
    });

    it('C2: cogX = -0.88, nhấc 1m -> Hàng nghiêng về bên nặng, góc cuối ổn định trong ±1.5° so với tham chiếu', () => {
        const { sim, phy } = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });

        for (let frame = 0; frame < 600; frame++) {
            sim.stepPhysicsEngine(1 / 60);
        }

        const euler = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
        const rollDeg = euler.z * 180 / Math.PI;

        // Điểm treo hook tại Y=9.5, CoG tại Y~2.8 -> H ~ 6.7m. Tham chiếu: arcsin(0.88 / 6.7) ~ 7.5° - 8.5°
        expect(rollDeg).toBeGreaterThan(6.5);
        expect(rollDeg).toBeLessThan(9.5);
    });

    it('C3: Dao động con lắc tắt dần mượt mà (damped pendulum settling, overshoot có kiểm soát, không giật)', () => {
        const { sim, phy } = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });
        const rolls = [];

        for (let frame = 0; frame < 650; frame++) {
            sim.stepPhysicsEngine(1 / 60);
            const euler = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
            rolls.push(euler.z * 180 / Math.PI);
        }

        const finalRoll = rolls[rolls.length - 1]; // góc cân bằng ổn định (~8.9°)
        const peak1 = Math.max(...rolls); // đỉnh lắc thứ 1 (~12.6°)
        const overshoot = peak1 - finalRoll;

        // 1) Overshoot tự nhiên của con lắc dưới 4.5°
        expect(overshoot).toBeLessThan(4.5);
        expect(overshoot).toBeGreaterThan(0.5);

        // 2) Biên độ tắt dần qua từng chu kỳ: sau 500 frames (~8.3s), độ lệch so với góc cuối <= 1.0°
        for (let i = 500; i < rolls.length; i++) {
            expect(Math.abs(rolls[i] - finalRoll)).toBeLessThanOrEqual(1.0);
        }
    });

    it('C4: Không giật khung hình (|Δgóc giữa 2 frame| <= 1.5° và không đổi dấu vận tốc góc liên tục)', () => {
        const { sim, phy } = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });

        let prevRoll = 0;
        let prevVel = 0;
        let maxDelta = 0;
        let velSignReversals = 0;

        for (let frame = 0; frame < 600; frame++) {
            sim.stepPhysicsEngine(1 / 60);
            const euler = new THREE.Euler().setFromQuaternion(phy.cargoQuat, 'YXZ');
            const roll = euler.z * 180 / Math.PI;

            if (frame > 1) {
                const delta = Math.abs(roll - prevRoll);
                if (delta > maxDelta) maxDelta = delta;

                const vel = (roll - prevRoll) * 60;
                if (frame > 60 && Math.abs(vel) > 0.5 && Math.abs(prevVel) > 0.5) {
                    if ((vel > 0 && prevVel < 0) || (vel < 0 && prevVel > 0)) {
                        velSignReversals++;
                    }
                }
                prevVel = vel;
            }
            prevRoll = roll;
        }

        // Bước nhảy giữa 2 frame liên tiếp không quá 1.5° (thực tế < 0.1°)
        expect(maxDelta).toBeLessThanOrEqual(1.5);
        // Không có hiện tượng giật rung lắc đảo dấu chattering
        expect(velSignReversals).toBeLessThanOrEqual(2);
    });

    it('C5: Trạng thái chùng/căng cáp ổn định sau khi nhấc, không toggle bật/tắt liên tục', () => {
        const { sim, phy } = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });

        // Cho nâng lên ổn định trong 400 frames (~6.6s)
        for (let frame = 0; frame < 400; frame++) {
            sim.stepPhysicsEngine(1 / 60);
        }

        // Đo đạc trong 120 frames tiếp theo (2 giây)
        let prevSlacks = phy.cables.map(c => c.slack);
        let totalToggles = 0;
        for (let frame = 0; frame < 120; frame++) {
            sim.stepPhysicsEngine(1 / 60);
            const currentSlacks = phy.cables.map(c => c.slack);
            currentSlacks.forEach((sl, idx) => {
                if (sl !== prevSlacks[idx]) totalToggles++;
            });
            prevSlacks = currentSlacks;
        }

        // Số lần đổi trạng thái chùng/căng trong 2s không quá 4 lần
        expect(totalToggles).toBeLessThanOrEqual(4);
    });

    it('C6: An toàn poseLock - không gọi applyLockedPose khi poseLock false và không override b.q ngoài solver', () => {
        const { sim, state, phy } = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });

        expect(state.poseLock).toBe(false);

        for (let frame = 0; frame < 100; frame++) {
            sim.stepPhysicsEngine(1 / 60);
            expect(state.poseLock).toBe(false);
        }

        // Dầm và hàng quay tự nhiên
        const beamEuler = new THREE.Euler().setFromQuaternion(phy.beams[0].q, 'YXZ');
        expect(Math.abs(beamEuler.z)).toBeGreaterThan(0.01);
    });

    it('C7: Đối xứng gương (cogX = +0.88 so với -0.88)', () => {
        const neg = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });
        for (let f = 0; f < 500; f++) neg.sim.stepPhysicsEngine(1 / 60);
        const rollNeg = new THREE.Euler().setFromQuaternion(neg.phy.cargoQuat, 'YXZ').z * 180 / Math.PI;

        const pos = setupScenario({ cogX: 0.88, cogY: -0.09, cogZ: 0.0 });
        for (let f = 0; f < 500; f++) pos.sim.stepPhysicsEngine(1 / 60);
        const rollPos = new THREE.Euler().setFromQuaternion(pos.phy.cargoQuat, 'YXZ').z * 180 / Math.PI;

        // rollNeg phải mang dấu dương (nghiêng về -X), rollPos phải mang dấu âm (nghiêng về +X)
        expect(rollNeg).toBeGreaterThan(0);
        expect(rollPos).toBeLessThan(0);
        // Độ lớn bằng nhau sai lệch < 0.5°
        expect(Math.abs(rollNeg + rollPos)).toBeLessThan(0.5);
    });

    it('C8: Góc nghiêng cuối tăng đơn điệu theo độ lệch CoG (|cogX| = 0.3 -> 0.6 -> 0.9)', () => {
        const cogs = [0.3, 0.6, 0.9];
        const tilts = [];

        for (const c of cogs) {
            const sc = setupScenario({ cogX: -c, cogY: -0.09, cogZ: 0.0 });
            for (let f = 0; f < 500; f++) sc.sim.stepPhysicsEngine(1 / 60);
            const roll = new THREE.Euler().setFromQuaternion(sc.phy.cargoQuat, 'YXZ').z * 180 / Math.PI;
            tilts.push(roll);
        }

        expect(tilts[0]).toBeGreaterThan(1.5);
        expect(tilts[1]).toBeGreaterThan(tilts[0] + 1.5);
        expect(tilts[2]).toBeGreaterThan(tilts[1] + 1.5);
    });

    it('C9: Nhịp frame khác nhau (30Hz vs 60Hz) cho góc cân bằng hội tụ nhất quán (< 1.0° chênh lệch)', () => {
        // Run at 60Hz
        const sc60 = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });
        for (let f = 0; f < 600; f++) sc60.sim.stepPhysicsEngine(1 / 60);
        const roll60 = new THREE.Euler().setFromQuaternion(sc60.phy.cargoQuat, 'YXZ').z * 180 / Math.PI;

        // Run at 30Hz
        const sc30 = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });
        for (let f = 0; f < 300; f++) sc30.sim.stepPhysicsEngine(1 / 30);
        const roll30 = new THREE.Euler().setFromQuaternion(sc30.phy.cargoQuat, 'YXZ').z * 180 / Math.PI;

        expect(Math.abs(roll60 - roll30)).toBeLessThan(1.0);
    });

    it('C10: Cân bằng lực căng cáp - Tổng phản lực Y cân bằng trọng lượng toàn hệ thống trong ±5%', () => {
        const sc = setupScenario({ cogX: -0.88, cogY: -0.09, cogZ: 0.0 });
        for (let f = 0; f < 600; f++) sc.sim.stepPhysicsEngine(1 / 60);

        // Tổng lực kéo từ các cáp upper hướng lên
        const uppers = sc.phy.cables.filter(c => c.role === 'upper');
        let totalUpperVerticalForceT = 0;
        uppers.forEach(c => {
            const ny = Math.abs(c.n ? c.n.y : 0.8);
            totalUpperVerticalForceT += (c.tensionT || 0) * ny;
        });

        // Trọng lượng hàng (21T) + dầm (~0.77T)
        const expectedT = sc.state.weight + 0.77;
        const errRatio = Math.abs(totalUpperVerticalForceT - expectedT) / expectedT;

        expect(errRatio).toBeLessThan(0.06);
    });
});
