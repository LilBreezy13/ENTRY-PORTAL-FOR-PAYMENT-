// GOOGLE APP SCRIPT WEB APP URLS

window.PORTAL_CONFIG = {
  // The shared Exam Directory Web App (backend/ExamDirectory.gs). This is
  // the ONE url that lists every exam and where the frontend fetches the
  // exam picker from. Deploy backend/ExamDirectory.gs once and paste its
  // /exec URL here.
  DIRECTORY_API_URL: 'https://script.google.com/macros/s/AKfycbyHg7TlFr_3gzAQyySwf9z68BRqciT0oujH2nujzRBuzJ5biOFoX2UJn9gKwLqi_NxRyg/exec',

  // Fallback: used only if the Exam Directory can't be reached at all and
  // no exam has ever been selected in this browser session — keeps the app
  // usable in single-exam mode exactly like before. Point this at whichever
  // exam's Code.gs Web App URL you want to use as the fallback.
  DEFAULT_API_URL: 'https://script.google.com/macros/s/AKfycbxJqzwMQiLnEIACDsYJvpeC4FzdFm1wN7OAfy__g9eBA0KyC6UImxUeU9K74d50Uv9d/exec',

  APP_NAME: 'Payment Entry Portal',
  CURRENCY: 'GH₵'
};
