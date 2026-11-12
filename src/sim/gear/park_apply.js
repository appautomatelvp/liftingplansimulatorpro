/**
 * gear/park_apply — parkHookSlack & apply gear
 * Split from legacy god-file (strangler Phase 2). Shared scope via assemble.
 */
        function parkHookSlack() {
            const lugsW = state.lugs.map(p => p.clone().applyQuaternion(phy.cargoQuat).add(phy.cargoPos));
            const cx = lugsW.reduce((s, p) => s + p.x, 0) / 4;
            const cz = lugsW.reduce((s, p) => s + p.z, 0) / 4;
            const maxY = Math.max(...lugsW.map(p => p.y));
            // Prefer CURRENT cable L0 (may be Nhớm-short). Parking at long design
            // height while L0 is still snug snatched the cargo off the quay.
            const meanL0 = (role, fallback) => {
                let s = 0, n = 0;
                (phy.cables || []).forEach(c => {
                    if (c.role !== role) return;
                    if (typeof cableIsBroken === 'function' && cableIsBroken(c)) return;
                    s += (c.L0 || fallback);
                    n += 1;
                });
                return n ? (s / n) : fallback;
            };
            let standbyHookY;
            if (state.beamType === 'spreader') {
                const halfSpan = Math.max(0.5, ((state.gear && state.gear.beam && state.gear.beam.lengthM) || state.L || 12.0) * 0.5);
                const upperL = meanL0('upper', state.upperSlingLength || 8.00);
                const lowerL = meanL0('leg', state.lowerSlingLength || 2.00);
                const upperH = Math.sqrt(Math.max(0.25, upperL * upperL - halfSpan * halfSpan));
                // +0.35 m so parked pose has slack, not a taut re-hoist.
                standbyHookY = THREE.MathUtils.clamp(maxY + lowerL + upperH + 0.35, 2.4, 35.0);
            } else if (state.beamType === 'container_spreader') {
                // Direct / cable STS: seat twistlocks or cable stand-off, then return.
                if (typeof seatStsSpreaderToCargo === 'function') {
                    seatStsSpreaderToCargo();
                    return;
                }
                let meanLeg = 0;
                let nLeg = 0;
                (phy.cables || []).forEach(c => {
                    if (c.role !== 'leg') return;
                    meanLeg += (c.L0 || 1);
                    nLeg += 1;
                });
                meanLeg = nLeg ? meanLeg / nLeg : 1.2;
                const cur = phy.hookPos ? phy.hookPos.y : (maxY + meanLeg);
                standbyHookY = THREE.MathUtils.clamp(
                    Math.min(cur, maxY + meanLeg + 0.40),
                    2.4, 35.0
                );
            } else if (state.beamType === 'frame' || state.beamType === 'lifting_beam') {
                const upperL = state.upperSlingLength || 4.5;
                const lowerL = state.lowerSlingLength || 2.5;
                standbyHookY = THREE.MathUtils.clamp(maxY + lowerL + upperL * 0.8, 2.4, 35.0);
            } else {
                standbyHookY = THREE.MathUtils.clamp(maxY + (state.slingLength || 4.0) * 0.8, 2.4, 30.0);
            }
            phy.autoHoistActive = false;
            phy.hoistSpeed = 0;
            phy.hookTarget.set(cx, standbyHookY, cz);
            phy.hookPos.copy(phy.hookTarget);
            phy.hookVel.set(0, 0, 0);
            phy.legTensions = [0, 0, 0, 0];
            phy.legSlacks = [true, true, true, true];
            const hookY = document.getElementById('inp-hook-y');
            if (hookY) hookY.value = standbyHookY.toFixed(2);
            const hookNum = document.getElementById('num-hook-y');
            if (hookNum) hookNum.value = standbyHookY.toFixed(2);
            const hookLbl = document.getElementById('val-hook-y');
            if (hookLbl) hookLbl.textContent = standbyHookY.toFixed(1) + 'm';
            const dockWinchEl = document.getElementById('val-hoist-y-dock') || document.getElementById('num-hoist-y-dock');
            if (dockWinchEl) dockWinchEl.textContent = standbyHookY.toFixed(1) + 'm';
            const numHookY = document.getElementById('num-hook-y');
            if (numHookY) numHookY.value = standbyHookY.toFixed(1);
        }
