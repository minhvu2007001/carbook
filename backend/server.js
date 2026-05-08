const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const Datastore = require('@seald-io/nedb');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'carbook_secret_2024';

['data','uploads'].forEach(d => {
  const p = path.join(__dirname, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p);
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/images', express.static(path.join(__dirname, '../images')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname)));
app.use(express.static(path.join(__dirname, '..')));

const db = {
  cars:     new Datastore({ filename: path.join(__dirname, 'data/cars.db'),     autoload: true }),
  blogs:    new Datastore({ filename: path.join(__dirname, 'data/blogs.db'),    autoload: true }),
  contacts: new Datastore({ filename: path.join(__dirname, 'data/contacts.db'), autoload: true }),
  bookings: new Datastore({ filename: path.join(__dirname, 'data/bookings.db'), autoload: true }),
  admins:   new Datastore({ filename: path.join(__dirname, 'data/admins.db'),   autoload: true }),
};

db.admins.findOne({ username: 'admin' }, (err, doc) => {
  if (!doc) {
    db.admins.insert({ username: 'admin', password: bcrypt.hashSync('admin123', 10), createdAt: new Date() });
    console.log('Tài khoản mặc định: admin / admin123');
  }
});

let emailConfig = { enabled: false };
const emailConfigPath = path.join(__dirname, 'data/email-config.json');
if (fs.existsSync(emailConfigPath)) {
  try { emailConfig = JSON.parse(fs.readFileSync(emailConfigPath)); } catch(e) {}
}

async function sendEmail(to, subject, html) {
  if (!emailConfig.enabled || !emailConfig.user) return false;
  try {
    const t = nodemailer.createTransport({
      host: emailConfig.host || 'smtp.gmail.com', port: emailConfig.port || 587,
      secure: false, auth: { user: emailConfig.user, pass: emailConfig.pass }
    });
    await t.sendMail({ from: emailConfig.user, to, subject, html });
    return true;
  } catch(e) { console.error('Email error:', e.message); return false; }
}

function auth(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch(e) { res.status(401).json({ error: 'Phiên đăng nhập hết hạn' }); }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

// AUTH
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  db.admins.findOne({ username }, (err, admin) => {
    if (!admin || !bcrypt.compareSync(password, admin.password))
      return res.status(401).json({ error: 'Tài khoản hoặc mật khẩu không đúng' });
    const token = jwt.sign({ id: admin._id, username }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, username });
  });
});

app.post('/api/auth/change-password', auth, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  db.admins.findOne({ username: req.admin.username }, (err, admin) => {
    if (!bcrypt.compareSync(oldPassword, admin.password))
      return res.status(400).json({ error: 'Mật khẩu cũ không đúng' });
    db.admins.update({ _id: admin._id }, { $set: { password: bcrypt.hashSync(newPassword, 10) } }, {}, () => {
      res.json({ message: 'Đổi mật khẩu thành công!' });
    });
  });
});

// EMAIL CONFIG
app.get('/api/email-config', auth, (req, res) => {
  res.json({ ...emailConfig, pass: emailConfig.pass ? '••••••••' : '' });
});
app.post('/api/email-config', auth, (req, res) => {
  if (req.body.pass === '••••••••') req.body.pass = emailConfig.pass;
  emailConfig = req.body;
  fs.writeFileSync(emailConfigPath, JSON.stringify(emailConfig));
  res.json({ message: 'Lưu cấu hình email thành công!' });
});
app.post('/api/email-test', auth, async (req, res) => {
  const ok = await sendEmail(emailConfig.user, 'Test - CarBook', '<h2>Email hoạt động! ✅</h2>');
  res.json({ message: ok ? 'Gửi test thành công!' : 'Thất bại, kiểm tra lại cấu hình.' });
});

// CARS
app.get('/api/cars', (req, res) => {
  const query = {};
  if (req.query.type && req.query.type !== 'all') query.type = req.query.type;
  if (req.query.maxPrice) query.price = { $lte: parseFloat(req.query.maxPrice) };
  if (req.query.seats) query.seats = { $gte: parseInt(req.query.seats) };
  if (req.query.transmission) query.transmission = req.query.transmission;
  db.cars.find(query).sort({ createdAt: -1 }).exec((err, docs) => res.json(err ? [] : docs));
});
app.get('/api/cars/:id', (req, res) => {
  db.cars.findOne({ _id: req.params.id }, (err, doc) => {
    doc ? res.json(doc) : res.status(404).json({ error: 'Không tìm thấy' });
  });
});
app.post('/api/cars', auth, upload.single('image'), (req, res) => {
  const { name, type, price, seats, doors, luggage, transmission, fuel, description } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Tên xe và giá là bắt buộc' });
  db.cars.insert({
    name, type: type||'sedan', price: parseFloat(price), seats: parseInt(seats)||4,
    doors: parseInt(doors)||4, luggage: parseInt(luggage)||2,
    transmission: transmission||'Automatic', fuel: fuel||'Gasoline',
    description: description||'',
    image: req.file ? `/uploads/${req.file.filename}` : '/images/car-default.jpg',
    createdAt: new Date()
  }, (err, doc) => err ? res.status(500).json({ error: err.message }) : res.status(201).json({ message: 'Thêm xe thành công!', car: doc }));
});
app.put('/api/cars/:id', auth, upload.single('image'), (req, res) => {
  const update = { ...req.body, updatedAt: new Date() };
  if (req.file) update.image = `/uploads/${req.file.filename}`;
  if (update.price) update.price = parseFloat(update.price);
  db.cars.update({ _id: req.params.id }, { $set: update }, {}, () => res.json({ message: 'Cập nhật thành công!' }));
});
app.delete('/api/cars/:id', auth, (req, res) => {
  db.cars.remove({ _id: req.params.id }, {}, () => res.json({ message: 'Đã xoá xe' }));
});

// BOOKINGS
app.post('/api/bookings', (req, res) => {
  const { carId, carName, name, email, phone, pickupDate, returnDate, pickupLocation, notes } = req.body;
  if (!name || !email || !phone || !pickupDate || !returnDate)
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });

  db.bookings.insert({
    carId, carName, name, email, phone, pickupDate, returnDate,
    pickupLocation: pickupLocation||'', notes: notes||'',
    status: 'pending', createdAt: new Date()
  }, async (err, doc) => {
    if (err) return res.status(500).json({ error: err.message });

    await sendEmail(email, `Xác nhận đặt xe - ${carName}`,
      `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="color:#f96d00">🚗 Đặt xe thành công!</h2>
        <p>Xin chào <strong>${name}</strong>, chúng tôi đã nhận yêu cầu của bạn.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><b>Xe</b></td><td style="padding:10px;border:1px solid #eee">${carName}</td></tr>
          <tr><td style="padding:10px;border:1px solid #eee"><b>Ngày nhận</b></td><td style="padding:10px;border:1px solid #eee">${pickupDate}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><b>Ngày trả</b></td><td style="padding:10px;border:1px solid #eee">${returnDate}</td></tr>
          <tr><td style="padding:10px;border:1px solid #eee"><b>Địa điểm</b></td><td style="padding:10px;border:1px solid #eee">${pickupLocation||'Sẽ liên hệ xác nhận'}</td></tr>
          <tr style="background:#f9f9f9"><td style="padding:10px;border:1px solid #eee"><b>SĐT</b></td><td style="padding:10px;border:1px solid #eee">${phone}</td></tr>
        </table>
        <p>Chúng tôi sẽ liên hệ xác nhận trong vòng <strong>30 phút</strong>.</p>
        <p style="color:#888;font-size:13px">— CarBook Team</p>
      </div>`
    );
    await sendEmail(emailConfig.user, `[Đặt xe mới] ${name} - ${carName}`,
      `<h3>Đặt xe mới!</h3><p>${name} | ${email} | ${phone}</p><p>Xe: ${carName}</p><p>${pickupDate} → ${returnDate}</p>`
    );

    res.status(201).json({ message: 'Đặt xe thành công! Chúng tôi sẽ liên hệ bạn sớm nhất.', booking: doc });
  });
});
app.get('/api/bookings', auth, (req, res) => {
  db.bookings.find({}).sort({ createdAt: -1 }).exec((err, docs) => res.json(err ? [] : docs));
});
app.put('/api/bookings/:id/status', auth, (req, res) => {
  db.bookings.update({ _id: req.params.id }, { $set: { status: req.body.status } }, {}, () =>
    res.json({ message: 'Cập nhật trạng thái thành công!' })
  );
});
app.delete('/api/bookings/:id', auth, (req, res) => {
  db.bookings.remove({ _id: req.params.id }, {}, () => res.json({ message: 'Đã xoá' }));
});

// BLOGS
app.get('/api/blogs', (req, res) => {
  db.blogs.find({}).sort({ createdAt: -1 }).exec((err, docs) => res.json(err ? [] : docs));
});
app.post('/api/blogs', auth, upload.single('image'), (req, res) => {
  const { title, content, author } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'Tiêu đề và nội dung là bắt buộc' });
  db.blogs.insert({
    title, content, author: author||'Admin',
    image: req.file ? `/uploads/${req.file.filename}` : '/images/image_1.jpg',
    createdAt: new Date()
  }, (err, doc) => err ? res.status(500).json({ error: err.message }) : res.status(201).json({ message: 'Đăng bài thành công!', blog: doc }));
});
app.delete('/api/blogs/:id', auth, (req, res) => {
  db.blogs.remove({ _id: req.params.id }, {}, () => res.json({ message: 'Đã xoá' }));
});

// CONTACTS
app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) return res.status(400).json({ error: 'Vui lòng điền đầy đủ thông tin' });
  db.contacts.insert({ name, email, subject, message, read: false, createdAt: new Date() }, async (err, doc) => {
    if (err) return res.status(500).json({ error: err.message });
    await sendEmail(emailConfig.user, `[Liên hệ] ${name}`,
      `<p><b>Tên:</b> ${name}</p><p><b>Email:</b> ${email}</p><p><b>Chủ đề:</b> ${subject||'—'}</p><p><b>Nội dung:</b> ${message}</p>`
    );
    res.status(201).json({ message: 'Gửi liên hệ thành công!' });
  });
});
app.get('/api/contacts', auth, (req, res) => {
  db.contacts.find({}).sort({ createdAt: -1 }).exec((err, docs) => res.json(err ? [] : docs));
});
app.delete('/api/contacts/:id', auth, (req, res) => {
  db.contacts.remove({ _id: req.params.id }, {}, () => res.json({ message: 'Đã xoá' }));
});

app.listen(PORT, () => {
  console.log(`\n✅ Server: http://localhost:${PORT}`);
  console.log(`📊 Admin: http://localhost:${PORT}/admin.html`);
  console.log(`🔐 Login: admin / admin123\n`);
});
