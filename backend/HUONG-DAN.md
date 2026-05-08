# 🚗 CARBOOK - HƯỚNG DẪN TÍCH HỢP DATABASE

## 📁 CẤU TRÚC THƯ MỤC SAU KHI TÍCH HỢP

```
your-website/
├── css/
├── fonts/
├── images/
├── js/
├── scss/
├── index.html
├── car.html
├── about.html
├── ... (các file html khác)
│
└── backend/               ← THƯ MỤC MỚI (copy vào đây)
    ├── server.js           ← Server chính
    ├── admin.html          ← Trang quản trị
    ├── package.json
    ├── node_modules/
    ├── data/               ← Database tự tạo
    │   ├── cars.db
    │   ├── blogs.db
    │   └── contacts.db
    └── uploads/            ← Ảnh upload tự tạo
```

---

## ⚡ BƯỚC 1: CÀI ĐẶT

### Yêu cầu
- **Node.js** phiên bản 16+  
  Tải tại: https://nodejs.org (chọn LTS)

### Cài packages
```bash
cd backend
npm install
```

---

## 🚀 BƯỚC 2: KHỞI ĐỘNG SERVER

```bash
cd backend
node server.js
```

Hoặc **double-click** file `START-SERVER.bat` (Windows)

Bạn sẽ thấy:
```
✅ Server đang chạy tại: http://localhost:3000
📊 Admin Panel: http://localhost:3000/admin.html
```

---

## 🎛️ BƯỚC 3: SỬ DỤNG ADMIN PANEL

Mở trình duyệt, vào: **http://localhost:3000/admin.html**

### Chức năng:
| Tab | Mô tả |
|-----|-------|
| 📊 Tổng quan | Xem thống kê nhanh |
| 🚗 Quản lý Xe | Thêm/Sửa/Xoá xe |
| 📝 Quản lý Blog | Đăng bài viết |
| 📬 Liên hệ | Xem tin nhắn từ khách |

### Thêm xe mới:
1. Click tab **"Quản lý Xe"**
2. Click nút **"➕ Thêm mới"**
3. Điền thông tin: Tên, Loại, Giá, Số ghế...
4. Upload ảnh xe
5. Click **"💾 Lưu xe"**

---

## 🔌 BƯỚC 4: KẾT NỐI CAR.HTML VỚI DATABASE

Mở file `car.html` gốc, thực hiện 2 thay đổi:

### 4a. Thêm ID vào container chứa xe
Tìm thẻ `<div class="row">` chứa danh sách xe, thêm `id`:
```html
<!-- TRƯỚC -->
<div class="row">
  <div class="col-md-4"> ... </div>
  ...
</div>

<!-- SAU -->  
<div class="row" id="car-list-container">
  <div class="col-12 text-center py-4">
    <p>Đang tải xe...</p>
  </div>
</div>
```

### 4b. Thêm script tải dữ liệu
Copy đoạn này vào cuối `car.html`, trước `</body>`:
```html
<script>
async function loadCarsFromDB() {
  try {
    const res = await fetch('http://localhost:3000/api/cars');
    const cars = await res.json();
    const container = document.getElementById('car-list-container');
    
    if (!cars.length) {
      container.innerHTML = '<div class="col-12 text-center"><p>Chưa có xe nào</p></div>';
      return;
    }
    
    container.innerHTML = cars.map(car => `
      <div class="col-md-4">
        <div class="car-wrap rounded ftco-animate">
          <a href="#" class="img rounded d-flex align-items-end"
             style="background-image: url('${car.image}');">
          </a>
          <div class="text">
            <div class="desc d-flex">
              <div class="one"><span>${car.transmission}</span><span>${car.fuel}</span></div>
              <div class="two"><span>${car.doors} Cửa</span><span>${car.seats} Ghế</span></div>
            </div>
            <div class="d-flex">
              <div class="heading">
                <h2><a href="#">${car.name}</a></h2>
              </div>
              <div class="price">
                <p>Thuê/ngày</p>
                <span>$${car.price}</span>
              </div>
            </div>
            <p><a href="#" class="btn btn-primary py-2 mr-1">Đặt ngay</a></p>
          </div>
        </div>
      </div>
    `).join('');
  } catch(e) { console.warn('Lỗi tải xe:', e); }
}
document.addEventListener('DOMContentLoaded', loadCarsFromDB);
</script>
```

---

## 🔌 TÍCH HỢP FORM LIÊN HỆ (contact.html)

Tìm nút submit trong `contact.html` và thêm xử lý:
```html
<script>
document.querySelector('.contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const data = {
    name: this.querySelector('[placeholder="Your Name"]').value,
    email: this.querySelector('[placeholder="Your Email"]').value,
    subject: this.querySelector('[placeholder="Subject"]').value,
    message: this.querySelector('textarea').value,
  };
  
  const res = await fetch('http://localhost:3000/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const result = await res.json();
  alert(result.message || result.error);
});
</script>
```

---

## 📡 DANH SÁCH API

| Method | URL | Mô tả |
|--------|-----|-------|
| GET | /api/cars | Lấy tất cả xe |
| GET | /api/cars/:id | Lấy 1 xe |
| POST | /api/cars | Thêm xe (form-data) |
| PUT | /api/cars/:id | Sửa xe |
| DELETE | /api/cars/:id | Xoá xe |
| GET | /api/blogs | Lấy tất cả blog |
| POST | /api/blogs | Thêm blog |
| DELETE | /api/blogs/:id | Xoá blog |
| POST | /api/contact | Gửi liên hệ |
| GET | /api/contacts | Xem tất cả liên hệ |

---

## 🌐 DEPLOY LÊN HOSTING (tuỳ chọn)

Để chạy trên server thực tế (thay vì localhost):
1. Thuê VPS hoặc dùng **Railway.app** (miễn phí)
2. Upload thư mục `backend/` lên
3. Chạy `node server.js`
4. Thay `http://localhost:3000` trong HTML thành địa chỉ server của bạn

---

## ❓ GẶP VẤN ĐỀ?

- **"Lỗi kết nối"**: Kiểm tra server có đang chạy không (`node server.js`)
- **"Port đã được dùng"**: Đổi `PORT = 3001` trong `server.js`
- **Ảnh không hiện**: Kiểm tra thư mục `uploads/` có tồn tại không
