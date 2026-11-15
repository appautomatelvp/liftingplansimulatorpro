# LỆNH @ — BẢNG 1 TRANG

## Quy tắc vàng
- **Không cần nhớ gì**: gõ tiếng Việt thường, AI tự chọn lệnh phù hợp và nói cho mày biết nó đã chọn lệnh nào (dòng "📚 Đã áp dụng").
- **Muốn chỉ định thẳng**: gõ `@lệnh` ở đầu hoặc giữa câu. Có thể gõ nhiều lệnh một câu: *"@ui @data làm bảng chấm công"*.
- 5 lệnh hay dùng nhất: **`@ui` `@data` `@test` `@spec` `@lego`**. Chừng nào quen thì dùng thêm.

## Lệnh về nghiệp vụ
| Gõ | Dùng khi | Ví dụ |
|---|---|---|
| `@spec` | Có ý tưởng mới, chưa rõ | `@spec app quản lý kho nhỏ cho tiệm xe` |
| `@ui` | Giao diện, màu, bảng, mobile, PDF/Excel | `@ui bảng này khó nhìn quá, làm giống app chấm công` |
| `@data` | Lưu dữ liệu, Firebase, chậm, hết quota, ảnh | `@data app đang đọc nhiều quá, sắp hết quota` |
| `@test` | Công thức, tiền, số liệu tính ra phải đúng | `@test kiểm tra công thức tính phí` |
| `@lego` | Làm lại tính năng đã có ở app cũ | `@lego lấy VietQR từ CARBOOK sang` |
| `@3d` | App 3D, mô phỏng, vật lý | `@3d thêm cần cẩu quay được` |
| `@saas` | Bán cho khách, gói cước, thanh toán | `@saas hết hạn thì chỉ cho xem` |
| `@insight` | **Đếm lượng người dùng, phân tích thói quen khách & hộp thư Feedback/Báo lỗi** (mặc định tiết kiệm quota) | `@insight thêm nút góp ý và bảng xem lượng người dùng cho admin` |

## Lệnh về quy trình
| Gõ | Dùng khi |
|---|---|
| `@plan` | Việc lớn: AI lập kế hoạch từng bước rồi dừng (dùng model mạnh) |
| `làm tiếp` hoặc `@tiep` | Thực thi kế hoạch, 1 bước mỗi lần (dùng model rẻ) |
| `@upgrade` | **Nâng cấp & tái cấu trúc dự án cũ** về chuẩn mới (khám bệnh → backup → tách từng file >300 dòng + lắp bộ giáp dữ liệu mà không làm hỏng app đang chạy) |
| `@debug` | Có lỗi: treo, trắng màn hình, tính sai |
| `@secure` | Muốn soi bảo mật, đăng nhập, phân quyền |
| `@ship` | Chuẩn bị cho khách thật dùng (chuyển PRODUCTION) |
| `@map` | Dự án cũ chưa có bộ nhớ: AI đọc 1 lần và viết ngữ cảnh |
| `@backup` | Muốn backup ngay |
| `@chot` | Hài lòng rồi, chốt bản ổn (gộp main + gắn mốc) |
| `@help` | Quên lệnh, AI in lại bảng này |

## Gõ `@` mà không thấy hiện gợi ý?
- **Cursor**: gõ `@ui` sẽ ra rule tên `ui`. Không ra thì cứ gõ chữ `@ui` trong câu, AI vẫn hiểu vì luật dặn vậy.
- **Antigravity**: lệnh là "skill" cùng tên (`ui`, `data`...). Gõ `@ui` trong câu là đủ.

## Khi AI làm sai
Gõ nguyên văn thấy gì + `@debug`. Ví dụ: *"@debug bấm lưu không thấy gì, F12 báo đỏ: ..."*
