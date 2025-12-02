// /saori/frontend/js/main.js
// JS genérico de UI y métricas. No define API_BASE.

document.addEventListener('DOMContentLoaded', function () {
  setupEventListeners();
  initializeAnalytics();
});

function setupEventListeners() {
  const bookingButton = document.getElementById('booking-button');
  if (bookingButton) {
    bookingButton.addEventListener('click', handleBooking);
  }
}

function handleBooking() {
  alert('Booking process initiated!');
}

function initializeAnalytics() {
  console.log('Analytics initialized');
}
