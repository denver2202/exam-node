const patterns = {
  login: /^[A-Za-z0-9]{6,}$/,
  password: /^.{8,}$/,
  fullName: /^[А-Яа-яЁё\s]+$/,
  phone: /^8\(\d{3}\)\d{3}-\d{2}-\d{2}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
};

export function validateRegister(body) {
  const errors = {};
  const { login, password, full_name, phone, email } = body;

  if (!login?.trim()) errors.login = 'Логин обязателен';
  else if (!patterns.login.test(login)) {
    errors.login = 'Латиница и цифры, не меньше 6 символов';
  }

  if (!password) errors.password = 'Пароль обязателен';
  else if (!patterns.password.test(password)) {
    errors.password = 'Пароль не меньше 8 символов';
  }

  if (!full_name?.trim()) errors.full_name = 'ФИО обязательно';
  else if (!patterns.fullName.test(full_name.trim())) {
    errors.full_name = 'Только кириллица и пробелы';
  }

  if (!phone?.trim()) errors.phone = 'Телефон обязателен';
  else if (!patterns.phone.test(phone.trim())) {
    errors.phone = 'Формат: 8(XXX)XXX-XX-XX';
  }

  if (!email?.trim()) errors.email = 'Email обязателен';
  else if (!patterns.email.test(email.trim())) {
    errors.email = 'Некорректный email';
  }

  return errors;
}

export function validateLogin(body) {
  const errors = {};
  if (!body.login?.trim()) errors.login = 'Логин обязателен';
  if (!body.password) errors.password = 'Пароль обязателен';
  return errors;
}

export function validateApplication(body) {
  const errors = {};
  if (!body.room_id) errors.room_id = 'Выберите помещение';
  if (!body.event_date) errors.event_date = 'Укажите дату';
  if (!body.payment || !['cash', 'sbp'].includes(body.payment)) {
    errors.payment = 'Выберите способ оплаты';
  }
  return errors;
}

export { patterns };
