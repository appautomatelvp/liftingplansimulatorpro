// [LOCKED] - BỘ KIỂM CHỨNG ĐỘ CHÍNH XÁC CÔNG THỨC TOÁN HỌC & KỸ THUẬT (V4.5)
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
  return passed === testCases.length;
}
