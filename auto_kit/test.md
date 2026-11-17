# @test — KÉT SẮT KIỂM CHỨNG SỐ LIỆU & CÔNG THỨC KỸ THUẬT (LOGIC VERIFICATION VAULT - V7)
**Đúc kết từ các engine tính toán thực tế trong `D:\APP PROJECT`:**
- `LIFTING PLAN SIMULATOR PRO`: `RiggingRuleEngine.js`, `CraneLoadChartEngine.js`, `GroundPressureEngine.js`, `CableDynamicsXPBD.js`, `EngineeringEngine.js`
- `CARBOOK`: `fuelEconomy.js` (tính tiêu hao L/100km & chi phí/km), `serviceSchedule.js` (tính mốc ODO & ngày bảo dưỡng)
- `ROSTER2`: `rosterGenerate.js`, `doubleShift.js`, `rosterGroupFairness.js`
- `shiftreportcmitapp` & `containercheckingcmitapp`: `calculations.js`, `boeLogic.js`, `useWeighing.js`

---

## TẠI SAO PHẢI CÓ KÉT SẮT NÀY?
Trong phần mềm kỹ thuật và vận hành, **F12 không báo đỏ KHÔNG CÓ NGHĨA LÀ AI TÍNH ĐÚNG!** Chỉ cần AI sửa nhầm hệ số an toàn cáp (`STANDARD_SAFETY_FACTORS`) hoặc công thức tính mức tiêu hao nhiên liệu, phần mềm vẫn chạy mượt nhưng số liệu sai lệch nghiêm trọng.

---

## 1. BẢNG BỘ SỐ CHUẨN ĐÃ KIỂM CHỨNG (GOLDEN TEST CASES)

| Dự án / Module | Hàm Mục Tiêu | Đầu Vào Mẫu (Input) | Kết Quả Bắt Buộc (Expected) | Sai số |
| :--- | :--- | :--- | :--- | :--- |
| **SafeLift3D (`RiggingRuleEngine`)** | `resolveSling()` | `{ slingType: 'wire', diaMm: 22, parts: 2, angleDeg: 60 }` | `sf >= 5.0`, hệ số góc `cos(30°) = 0.866`, trạng thái `SAFE` | `± 0.01` |
| **SafeLift3D (`DnvFourPointLift`)** | `resolveFourLegDiagonalLoad()` | `{ totalLoadT: 20, cogOffsetXZ: {x:0,z:0}, skl: 1.25, isRigid: true }` | `activeDiagonal: [0,2]`, `tensionsT: [12.5, 0, 12.5, 0]`, `sklUsed: 1.25` | `± 0.01` |
| **SafeLift3D (`HierarchicalNaming`)** | `assignHierarchicalNames()` | Spreader 2 uppers (`-3m`, `+3m`) + 4 legs (2/end) | Uppers `LP1, LP2`; Left legs `LP11, LP12` (`parentName: 'LP1'`); Right legs `LP21, LP22` (`parentName: 'LP2'`) | Exact match |
| **CARBOOK (`fuelEconomy.js`)** | `computeFuelMetrics()` | `{ prevOdo: 12000, currOdo: 12500, liters: 35, price: 21000 }` | `distanceKm: 500`, `litersPer100Km: 7.0`, `vndPerKm: 1470` | `± 0.05` |
| **CMIT Weighing (`useWeighing.js`)** | `calculateResult()` | `{ weight1: "28,5", weight2: "28.5", tare: 3.8 }` | `gross1: 28.5`, `gross2: 28.5`, `netWeight: 24.7` | `± 0.01` |
| **CMIT Shift (`boeLogic.js`)** | `computeBoeMetrics()` | `{ totalMoves: 1200, netHours: 8, cranes: 4 }` | `gmpH: 37.5` | `± 0.05` |

---

## 2. ĐOẠN CODE TỰ ĐỘNG KIỂM TRA CÔNG THỨC (`src/utils/logicVaultVerifier.js`)
> **CHỈ THỊ CHO AI:** Cài hàm này vào mọi dự án có tính toán logic để tự động chạy kiểm tra mỗi khi mở môi trường Local (`import.meta.env.DEV`).

```javascript
// [LOCKED] - BỘ KIỂM CHỨNG ĐỘ CHÍNH XÁC CÔNG THỨC TOÁN HỌC & KỸ THUẬT
export function verifyGoldenLogicVault(moduleName, calculateFn, testCases) {
  let passed = 0;
  testCases.forEach((tc) => {
    try {
      const actual = calculateFn(tc.input);
      const isMatch = Object.keys(tc.expected).every((key) => {
        const expVal = tc.expected[key];
        const actVal = actual?.[key];
        if (typeof expVal === "number") {
          return Math.abs(Number(actVal) - expVal) <= (tc.tolerance ?? 0.05);
        }
        return actVal === expVal;
      });
      if (!isMatch) {
        console.error(
          `🚨 [SAI LỆCH CÔNG THỨC - ${moduleName} - ${tc.id}]:`,
          "Input:", tc.input,
          "Kỳ vọng:", tc.expected,
          "Thực tế:", actual
        );
      } else {
        passed++;
      }
    } catch (err) {
      console.error(`❌ [LỖI CHẠY TEST - ${moduleName} - ${tc.id}]:`, err);
    }
  });
  console.log(`✅ [LOGIC VAULT - ${moduleName}]: Đạt ${passed}/${testCases.length} ca kiểm thử chuẩn.`);
}
```
