// booking.js - Manages the booking system functionality, including the reservation process.

document.addEventListener('DOMContentLoaded', function() {
    const bookingForm = document.getElementById('booking-form');
    const serviceSelect = document.getElementById('service-select');
    const dateInput = document.getElementById('date-input');
    const timeInput = document.getElementById('time-input');
    const customerNameInput = document.getElementById('customer-name-input');
    const customerEmailInput = document.getElementById('customer-email-input');
    const submitButton = document.getElementById('submit-button');
    const confirmationMessage = document.getElementById('confirmation-message');

    bookingForm.addEventListener('submit', function(event) {
        event.preventDefault();
        
        const service = serviceSelect.value;
        const date = dateInput.value;
        const time = timeInput.value;
        const customerName = customerNameInput.value;
        const customerEmail = customerEmailInput.value;

        if (service && date && time && customerName && customerEmail) {
            // Simulate a booking request
            const bookingData = {
                service,
                date,
                time,
                customerName,
                customerEmail
            };

            // Here you would typically send the bookingData to the server
            // For example, using fetch:
            /*
            fetch('/api/bookings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(bookingData)
            })
            .then(response => response.json())
            .then(data => {
                confirmationMessage.textContent = 'Booking confirmed! Check your email for details.';
            })
            .catch(error => {
                confirmationMessage.textContent = 'There was an error with your booking. Please try again.';
            });
            */

            // For now, just display a confirmation message
            confirmationMessage.textContent = 'Booking confirmed! Check your email for details.';
        } else {
            confirmationMessage.textContent = 'Please fill in all fields.';
        }
    });
});