// ========================================
// BELLA ESTÉTICA - SISTEMA DE RESERVAS
// ========================================

// Estado global del booking
let bookingState = {
    currentStep: 1,
    selectedService: null,
    selectedDate: null,
    selectedTime: null,
    clientData: null,
    totalPrice: 0,
    originalPrice: 0,
    discount: 0,
    isFirstVisit: true // Por ahora asumimos que siempre es primera visita
};

// Configuración
const BOOKING_CONFIG = {
    businessHours: {
        start: 9,
        end: 19,
        lunchBreak: { start: 13, end: 14 }
    },
    workDays: [1, 2, 3, 4, 5, 6], // Lunes a Sábado
    saturdayHours: { start: 9, end: 15 },
    timeSlotDuration: 30, // minutos
    firstVisitDiscount: 0.30, // 30%
    maxAdvanceBookingDays: 60
};

// Servicios disponibles
const SERVICES = {
    'Limpieza Facial Profunda': { price: 3500, duration: 60, slots: 2 },
    'Depilación Láser': { price: 4200, duration: 90, slots: 3 },
    'Tratamiento Antienvejecimiento': { price: 2800, duration: 45, slots: 2 },
    'Tratamiento Corporal Completo': { price: 5000, duration: 120, slots: 4 },
    'Diseño de Cejas': { price: 1800, duration: 30, slots: 1 },
    'Paquete Premium': { price: 6500, duration: 150, slots: 5 }
};

// Mercado Pago instance
let mp = null;

// ========================================
// INICIALIZACIÓN
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    initBookingSystem();
    console.log('💅 Sistema de Reservas iniciado');
});

function initBookingSystem() {
    initModal();
    initServiceSelection();
    initCalendar();
    initTimeSlots();
    initClientForm();
    initStepNavigation();
    initMercadoPago();
    
    // Event listeners globales
    document.addEventListener('click', handleGlobalClicks);
}

// ========================================
// MODAL MANAGEMENT
// ========================================

function initModal() {
    const modal = document.getElementById('bookingModal');
    const closeBtn = modal.querySelector('.close');
    
    // Cerrar modal
    closeBtn.addEventListener('click', closeBookingModal);
    
    // Cerrar al hacer click fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeBookingModal();
        }
    });
    
    // Prevenir cierre con ESC en pasos avanzados
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && bookingState.currentStep <= 2) {
            closeBookingModal();
        }
    });
}

function openBookingModal(preselectedService = null) {
    const modal = document.getElementById('bookingModal');
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
    
    // Reset booking state
    resetBookingState();
    
    // Pre-seleccionar servicio si viene de botón específico
    if (preselectedService) {
        selectServiceOption(preselectedService);
    }
    
    // Analytics
    gtag('event', 'booking_modal_opened', {
        'event_category': 'booking',
        'event_label': preselectedService || 'general'
    });
    
    // Facebook Pixel
    fbq('track', 'InitiateCheckout');
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
    
    // Analytics solo si abandonó proceso
    if (bookingState.currentStep > 1) {
        gtag('event', 'booking_abandoned', {
            'event_category': 'booking',
            'event_label': `step_${bookingState.currentStep}`,
            'value': bookingState.currentStep
        });
    }
    
    resetBookingState();
}

function resetBookingState() {
    bookingState = {
        currentStep: 1,
        selectedService: null,
        selectedDate: null,
        selectedTime: null,
        clientData: null,
        totalPrice: 0,
        originalPrice: 0,
        discount: 0,
        isFirstVisit: true
    };
    
    // Reset UI
    showStep(1);
    clearAllSelections();
}

// ========================================
// STEP NAVIGATION
// ========================================

function initStepNavigation() {
    const nextBtn = document.getElementById('nextStep');
    const prevBtn = document.getElementById('prevStep');
    
    nextBtn.addEventListener('click', goToNextStep);
    prevBtn.addEventListener('click', goToPreviousStep);
}

function showStep(stepNumber) {
    // Actualizar steps visuales
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 <= stepNumber);
    });
    
    // Mostrar contenido del step
    document.querySelectorAll('.booking-step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 === stepNumber);
    });
    
    // Actualizar botones
    const prevBtn = document.getElementById('prevStep');
    const nextBtn = document.getElementById('nextStep');
    
    prevBtn.style.display = stepNumber > 1 ? 'block' : 'none';
    
    // Cambiar texto del botón según step
    switch(stepNumber) {
        case 1:
            nextBtn.textContent = 'Siguiente';
            nextBtn.disabled = !bookingState.selectedService;
            break;
        case 2:
            nextBtn.textContent = 'Siguiente';
            nextBtn.disabled = !bookingState.selectedDate || !bookingState.selectedTime;
            break;
        case 3:
            nextBtn.textContent = 'Continuar al Pago';
            nextBtn.disabled = !isClientFormValid();
            break;
        case 4:
            nextBtn.style.display = 'none'; // El pago maneja su propio botón
            break;
    }
    
    bookingState.currentStep = stepNumber;
}

async function goToNextStep() {
    const currentStep = bookingState.currentStep;
    
    // Validaciones por step
    switch(currentStep) {
        case 1:
            if (!bookingState.selectedService) {
                showError('Por favor selecciona un servicio');
                return;
            }
            break;
            
        case 2:
            if (!bookingState.selectedDate || !bookingState.selectedTime) {
                showError('Por favor selecciona fecha y horario');
                return;
            }
            
            // Verificar disponibilidad antes de continuar
            const isAvailable = await checkTimeSlotAvailability();
            if (!isAvailable) {
                showError('Lo sentimos, ese horario ya no está disponible. Por favor elige otro.');
                await loadAvailableTimeSlots(bookingState.selectedDate);
                return;
            }
            break;
            
        case 3:
            if (!isClientFormValid()) {
                showError('Por favor completa todos los campos requeridos');
                return;
            }
            
            // Guardar datos del cliente
            bookingState.clientData = getClientFormData();
            updateBookingSummary();
            
            // Preparar Mercado Pago
            await setupMercadoPago();
            break;
    }
    
    // Analytics por step
    gtag('event', `booking_step_${currentStep}_completed`, {
        'event_category': 'booking',
        'event_label': bookingState.selectedService
    });
    
    showStep(currentStep + 1);
}

function goToPreviousStep() {
    if (bookingState.currentStep > 1) {
        showStep(bookingState.currentStep - 1);
    }
}

// ========================================
// STEP 1: SELECCIÓN DE SERVICIO
// ========================================

function initServiceSelection() {
    const serviceOptions = document.querySelectorAll('.service-option');
    
    serviceOptions.forEach(option => {
        option.addEventListener('click', () => {
            const service = option.dataset.service;
            const price = parseInt(option.dataset.price);
            const duration = parseInt(option.dataset.duration);
            
            selectServiceOption(service, price, duration);
        });
    });
}

function selectServiceOption(serviceName, price = null, duration = null) {
    // Obtener datos del servicio
    const serviceData = SERVICES[serviceName];
    if (!serviceData && (!price || !duration)) {
        console.error('Servicio no encontrado:', serviceName);
        return;
    }
    
    const finalPrice = price || serviceData.price;
    const finalDuration = duration || serviceData.duration;
    
    // Actualizar estado
    bookingState.selectedService = serviceName;
    bookingState.originalPrice = finalPrice;
    bookingState.discount = bookingState.isFirstVisit ? finalPrice * BOOKING_CONFIG.firstVisitDiscount : 0;
    bookingState.totalPrice = finalPrice - bookingState.discount;
    
    // Actualizar UI
    document.querySelectorAll('.service-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`[data-service="${serviceName}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Habilitar botón siguiente
    document.getElementById('nextStep').disabled = false;
    
    // Analytics
    gtag('event', 'service_selected', {
        'event_category': 'booking',
        'event_label': serviceName,
        'value': finalPrice
    });
}

function selectService(serviceName, price, duration) {
    openBookingModal();
    setTimeout(() => {
        selectServiceOption(serviceName, price, duration);
    }, 300);
}

// ========================================
// STEP 2: CALENDARIO Y HORARIOS
// ========================================

function initCalendar() {
    const calendar = document.getElementById('calendar');
    const currentMonthEl = document.getElementById('currentMonth');
    const prevBtn = document.querySelector('.prev-month');
    const nextBtn = document.querySelector('.next-month');
    
    let currentDate = new Date();
    
    prevBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    });
    
    nextBtn.addEventListener('click', () => {
        currentDate.setMonth(currentDate.getMonth() + 1);
        renderCalendar();
    });
    
    function renderCalendar() {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Actualizar header
        currentMonthEl.textContent = new Intl.DateTimeFormat('es-ES', {
            month: 'long',
            year: 'numeric'
        }).format(currentDate);
        
        // Limpiar calendario
        calendar.innerHTML = '';
        
        // Headers de días
        const dayHeaders = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        dayHeaders.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-header-day';
            dayEl.textContent = day;
            dayEl.style.fontWeight = '600';
            dayEl.style.textAlign = 'center';
            dayEl.style.padding = '8px 4px';
            dayEl.style.fontSize = '0.8rem';
            dayEl.style.color = 'var(--gray)';
            calendar.appendChild(dayEl);
        });
        
        // Primer día del mes y días en el mes
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(maxDate.getDate() + BOOKING_CONFIG.maxAdvanceBookingDays);
        
        // Espacios vacíos al inicio
        for (let i = 0; i < firstDay; i++) {
            const emptyDay = document.createElement('div');
            calendar.appendChild(emptyDay);
        }
        
        // Días del mes
        for (let day = 1; day <= daysInMonth; day++) {
            const dayDate = new Date(year, month, day);
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            
            // Verificar si es día válido
            const isWorkDay = BOOKING_CONFIG.workDays.includes(dayDate.getDay());
            const isInRange = dayDate >= today && dayDate <= maxDate;
            const isToday = dayDate.toDateString() === today.toDateString();
            
            if (!isWorkDay || !isInRange) {
                dayEl.classList.add('disabled');
            } else {
                dayEl.addEventListener('click', () => selectDate(dayDate));
                
                if (isToday) {
                    dayEl.style.border = '2px solid var(--primary-color)';
                }
            }
            
            calendar.appendChild(dayEl);
        }
    }
    
    renderCalendar();
}

async function selectDate(date) {
    // Actualizar estado
    bookingState.selectedDate = date;
    bookingState.selectedTime = null; // Reset tiempo seleccionado
    
    // Actualizar UI
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    event.target.classList.add('selected');
    
    // Cargar horarios disponibles
    await loadAvailableTimeSlots(date);
    
    // Actualizar botón siguiente
    updateNextButtonState();
}

async function loadAvailableTimeSlots(date) {
    const timeSlotsContainer = document.getElementById('timeSlots');
    const serviceDuration = SERVICES[bookingState.selectedService].duration;
    
    // Loading state
    timeSlotsContainer.innerHTML = '<div class="spinner"></div>';
    
    try {
        // Obtener horarios ocupados del servidor
        const occupiedSlots = await getOccupiedTimeSlots(date);
        
        // Generar horarios disponibles
        const availableSlots = generateTimeSlots(date, serviceDuration, occupiedSlots);
        
        // Renderizar horarios
        renderTimeSlots(availableSlots);
        
    } catch (error) {
        console.error('Error cargando horarios:', error);
        timeSlotsContainer.innerHTML = '<p>Error cargando horarios. Por favor intenta de nuevo.</p>';
    }
}

function generateTimeSlots(date, serviceDuration, occupiedSlots = []) {
    const slots = [];
    const dayOfWeek = date.getDay();
    const isToday = date.toDateString() === new Date().toDateString();
    const currentHour = new Date().getHours();
    
    // Determinar horarios de trabajo
    let startHour = BOOKING_CONFIG.businessHours.start;
    let endHour = BOOKING_CONFIG.businessHours.end;
    
    if (dayOfWeek === 6) { // Sábado
        endHour = BOOKING_CONFIG.saturdayHours.end;
    }
    
    // Generar slots cada 30 minutos
    for (let hour = startHour; hour < endHour; hour++) {
        for (let minute = 0; minute < 60; minute += BOOKING_CONFIG.timeSlotDuration) {
            // Skip lunch break
            if (hour >= BOOKING_CONFIG.businessHours.lunchBreak.start && 
                hour < BOOKING_CONFIG.businessHours.lunchBreak.end) {
                continue;
            }
            
            const slotTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
            const slotDateTime = new Date(date);
            slotDateTime.setHours(hour, minute, 0, 0);
            
            // Skip si es pasado (para hoy)
            if (isToday && hour <= currentHour) {
                continue;
            }
            
            // Verificar si hay espacio suficiente para el servicio
            const serviceSlotsNeeded = Math.ceil(serviceDuration / BOOKING_CONFIG.timeSlotDuration);
            let hasSpace = true;
            
            for (let i = 0; i < serviceSlotsNeeded; i++) {
                const checkTime = new Date(slotDateTime);
                checkTime.setMinutes(checkTime.getMinutes() + (i * BOOKING_CONFIG.timeSlotDuration));
                const checkTimeStr = `${checkTime.getHours().toString().padStart(2, '0')}:${checkTime.getMinutes().toString().padStart(2, '0')}`;
                
                if (occupiedSlots.includes(checkTimeStr)) {
                    hasSpace = false;
                    break;
                }
            }
            
            slots.push({
                time: slotTime,
                available: hasSpace,
                datetime: slotDateTime
            });
        }
    }
    
    return slots;
}

function renderTimeSlots(slots) {
    const container = document.getElementById('timeSlots');
    
    if (slots.length === 0) {
        container.innerHTML = '<p>No hay horarios disponibles para esta fecha.</p>';
        return;
    }
    
    const slotsHTML = slots.map(slot => `
        <div class="time-slot ${slot.available ? '' : 'unavailable'}" 
             data-time="${slot.time}"
             ${slot.available ? `onclick="selectTimeSlot('${slot.time}')"` : ''}>
            ${slot.time}
        </div>
    `).join('');
    
    container.innerHTML = slotsHTML;
}

function selectTimeSlot(time) {
    // Actualizar estado
    bookingState.selectedTime = time;
    
    // Actualizar UI
    document.querySelectorAll('.time-slot').forEach(slot => {
        slot.classList.remove('selected');
    });
    
    event.target.classList.add('selected');
    
    // Actualizar botón siguiente
    updateNextButtonState();
    
    // Analytics
    gtag('event', 'time_slot_selected', {
        'event_category': 'booking',
        'event_label': `${bookingState.selectedDate.toISOString().split('T')[0]}_${time}`
    });
}

async function getOccupiedTimeSlots(date) {
    try {
        const dateStr = date.toISOString().split('T')[0];
        const response = await window.BellaEstetica.apiCall(`/bookings/occupied-slots?date=${dateStr}`);
        return response.occupiedSlots || [];
    } catch (error) {
        console.error('Error obteniendo slots ocupados:', error);
        return []; // Devolver array vacío en caso de error
    }
}

async function checkTimeSlotAvailability() {
    try {
        const dateStr = bookingState.selectedDate.toISOString().split('T')[0];
        const response = await window.BellaEstetica.apiCall('/bookings/check-availability', {
            method: 'POST',
            body: JSON.stringify({
                date: dateStr,
                time: bookingState.selectedTime,
                service: bookingState.selectedService
            })
        });
        
        return response.available;
    } catch (error) {
        console.error('Error verificando disponibilidad:', error);
        return false;
    }
}

// ========================================
// STEP 3: DATOS DEL CLIENTE
// ========================================

function initClientForm() {
    const form = document.getElementById('clientForm');
    const inputs = form.querySelectorAll('input, textarea');
    
    // Validación en tiempo real
    inputs.forEach(input => {
        input.addEventListener('input', () => {
            validateField(input);
            updateNextButtonState();
        });
        
        input.addEventListener('blur', () => {
            validateField(input);
        });
    });
    
    // Validación especial para email
    const emailInput = form.querySelector('#email');
    emailInput.addEventListener('blur', validateEmail);
    
    // Validación especial para teléfono
    const phoneInput = form.querySelector('#phone');
    phoneInput.addEventListener('input', formatPhoneNumber);
}

function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';
    
    // Limpiar errores previos
    clearFieldError(field);
    
    // Validaciones por tipo
    switch(field.type) {
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Email inválido';
            }
            break;
            
        case 'tel':
            const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
            if (value && !phoneRegex.test(value)) {
                isValid = false;
                errorMessage = 'Teléfono inválido';
            }
            break;
    }
    
    // Validación required
    if (field.required && !value) {
        isValid = false;
        errorMessage = 'Este campo es requerido';
    }
    
    // Mostrar error si existe
    if (!isValid) {
        showFieldError(field, errorMessage);
    }
    
    return isValid;
}

function validateEmail(event) {
    const email = event.target.value.trim();
    if (!email) return;
    
    // Validación adicional de dominios comunes
    const commonDomains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com'];
    const domain = email.split('@')[1];
    
    if (domain && !commonDomains.includes(domain) && !domain.includes('.')) {
        showFieldError(event.target, 'Revisa que el email esté completo');
    }
}

function formatPhoneNumber(event) {
    let value = event.target.value.replace(/\D/g, '');
    
    // Formato argentino
    if (value.startsWith('54')) {
        value = value.substring(2);
    }
    
    if (value.length >= 10) {
        value = value.replace(/(\d{2})(\d{4})(\d{4})/, '$1 $2-$3');
    } else if (value.length >= 6) {
        value = value.replace(/(\d{2})(\d{4})/, '$1 $2-');
    } else if (value.length >= 2) {
        value = value.replace(/(\d{2})/, '$1 ');
    }
    
    event.target.value = value;
}

function showFieldError(field, message) {
    field.style.borderColor = 'var(--error)';
    
    // Crear o actualizar mensaje de error
    let errorEl = field.parentNode.querySelector('.field-error');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'field-error';
        errorEl.style.color = 'var(--error)';
        errorEl.style.fontSize = '0.8rem';
        errorEl.style.marginTop = '4px';
        field.parentNode.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
}

function clearFieldError(field) {
    field.style.borderColor = '';
    const errorEl = field.parentNode.querySelector('.field-error');
    if (errorEl) {
        errorEl.remove();
    }
}

function isClientFormValid() {
    const form = document.getElementById('clientForm');
    const requiredFields = form.querySelectorAll('input[required], textarea[required]');
    
    let isValid = true;
    
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
        }
    });
    
    return isValid;
}

function getClientFormData() {
    const form = document.getElementById('clientForm');
    const formData = new FormData(form);
    
    return {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        comments: formData.get('comments'),
        newsletter: formData.get('newsletter') === 'on',
        terms: formData.get('terms') === 'on'
    };
}

// ========================================
// STEP 4: RESUMEN Y PAGO
// ========================================

function updateBookingSummary() {
    document.getElementById('summaryService').textContent = bookingState.selectedService;
    document.getElementById('summaryDate').textContent = window.BellaEstetica.formatDate(bookingState.selectedDate);
    document.getElementById('summaryTime').textContent = bookingState.selectedTime;
    document.getElementById('summaryDuration').textContent = `${SERVICES[bookingState.selectedService].duration} minutos`;
    document.getElementById('summaryOriginalPrice').textContent = window.BellaEstetica.formatPrice(bookingState.originalPrice);
    document.getElementById('summaryDiscount').textContent = `-${window.BellaEstetica.formatPrice(bookingState.discount)}`;
    document.getElementById('summaryTotal').textContent = window.BellaEstetica.formatPrice(bookingState.totalPrice);
}

// ========================================
// MERCADO PAGO INTEGRATION
// ========================================

function initMercadoPago() {
    // Inicializar SDK de Mercado Pago
    if (typeof MercadoPago !== 'undefined') {
        mp = new MercadoPago('YOUR_PUBLIC_KEY', {
            locale: 'es-AR'
        });
    } else {
        console.warn('Mercado Pago SDK no cargado');
    }
}

async function setupMercadoPago() {
    if (!mp) {
        console.error('Mercado Pago no inicializado');
        return;
    }
    
    try {
        // Crear preferencia de pago
        const preference = await createPaymentPreference();
        
        // Crear botón de pago
        const bricksBuilder = mp.bricks();
        
        await bricksBuilder.create('wallet', 'mercado-pago-button', {
            initialization: {
                preferenceId: preference.id,
            },
            customization: {
                texts: {
                    valueProp: 'smart_option',
                },
            },
            callbacks: {
                onReady: () => {
                    console.log('Mercado Pago ready');
                },
                onSubmit: (data) => {
                    console.log('Payment submitted:', data);
                    handlePaymentSubmission(data);
                },
                onError: (error) => {
                    console.error('Mercado Pago error:', error);
                    showError('Error en el pago. Por favor intenta de nuevo.');
                }
            }
        });
        
    } catch (error) {
        console.error('Error configurando Mercado Pago:', error);
        showError('Error configurando el pago. Por favor recarga la página.');
    }
}

async function createPaymentPreference() {
    const bookingData = {
        service: bookingState.selectedService,
        date: bookingState.selectedDate.toISOString().split('T')[0],
        time: bookingState.selectedTime,
        client: bookingState.clientData,
        originalPrice: bookingState.originalPrice,
        discount: bookingState.discount,
        totalPrice: bookingState.totalPrice
    };
    
    try {
        const response = await window.BellaEstetica.apiCall('/payments/create-preference', {
            method: 'POST',
            body: JSON.stringify(bookingData)
        });
        
        return response.preference;
    } catch (error) {
        console.error('Error creando preferencia de pago:', error);
        throw error;
    }
}

async function handlePaymentSubmission(paymentData) {
    try {
        // Mostrar loading
        showPaymentLoading();
        
        // Crear booking en base de datos
        const booking = await createBooking(paymentData);
        
        // Analytics
        gtag('event', 'purchase', {
            'transaction_id': booking.id,
            'value': bookingState.totalPrice,
            'currency': 'ARS',
            'items': [{
                'item_id': bookingState.selectedService,
                'item_name': bookingState.selectedService,
                'category': 'service',
                'price': bookingState.totalPrice,
                'quantity': 1
            }]
        });
        
        // Facebook Pixel
        fbq('track', 'Purchase', {
            value: bookingState.totalPrice,
            currency: 'ARS',
            content_name: bookingState.selectedService,
            content_type: 'service'
        });
        
        // Mostrar confirmación
        showBookingConfirmation(booking);
        
    } catch (error) {
        console.error('Error procesando pago:', error);
        showPaymentError();
    }
}

async function createBooking(paymentData) {
    const bookingData = {
        service: bookingState.selectedService,
        date: bookingState.selectedDate.toISOString().split('T')[0],
        time: bookingState.selectedTime,
        duration: SERVICES[bookingState.selectedService].duration,
        client: bookingState.clientData,
        originalPrice: bookingState.originalPrice,
        discount: bookingState.discount,
        totalPrice: bookingState.totalPrice,
        paymentData: paymentData
    };
    
    const response = await window.BellaEstetica.apiCall('/bookings/create', {
        method: 'POST',
        body: JSON.stringify(bookingData)
    });
    
    return response.booking;
}

function showPaymentLoading() {
    const container = document.getElementById('mercado-pago-button');
    container.innerHTML = `
        <div style="text-align: center; padding: 2rem;">
            <div class="spinner"></div>
            <p>Procesando tu pago...</p>
        </div>
    `;
}

function showPaymentError() {
    const container = document.getElementById('mercado-pago-button');
    container.innerHTML = `
        <div class="error">
            <i class="fas fa-exclamation-triangle"></i>
            Error procesando el pago. Por favor intenta de nuevo.
            <button onclick="setupMercadoPago()" class="btn btn-primary" style="margin-top: 1rem;">
                Intentar de nuevo
            </button>
        </div>
    `;
}

function showBookingConfirmation(booking) {
    const modal = document.getElementById('bookingModal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header" style="background: var(--success); color: white;">
                <h2>¡Reserva Confirmada! ✅</h2>
            </div>
            <div style="padding: 2rem; text-align: center;">
                <div style="font-size: 4rem; color: var(--success); margin-bottom: 1rem;">
                    🎉
                </div>
                <h3>Tu turno ha sido reservado exitosamente</h3>
                <div style="background: var(--light-gray); padding: 1.5rem; border-radius: 8px; margin: 1.5rem 0;">
                    <p><strong>Código de reserva:</strong> #${booking.id}</p>
                    <p><strong>Servicio:</strong> ${booking.service}</p>
                    <p><strong>Fecha:</strong> ${window.BellaEstetica.formatDate(new Date(booking.date))}</p>
                    <p><strong>Hora:</strong> ${booking.time}</p>
                    <p><strong>Total pagado:</strong> ${window.BellaEstetica.formatPrice(booking.totalPrice)}</p>
                </div>
                <p>Te hemos enviado un email con todos los detalles de tu reserva.</p>
                <p>¡Te esperamos! 💅✨</p>
                <div style="margin-top: 2rem;">
                    <button onclick="closeBookingModal()" class="btn btn-primary">
                        Cerrar
                    </button>
                    <a href="https://wa.me/5491123456789?text=Hola! Acabo de reservar un turno (Código: ${booking.id})" 
                       target="_blank" class="btn btn-secondary" style="margin-left: 1rem;">
                        <i class="fab fa-whatsapp"></i>
                        Contactar por WhatsApp
                    </a>
                </div>
            </div>
        </div>
    `;
}

// ========================================
// UTILIDADES
// ========================================

function updateNextButtonState() {
    const nextBtn = document.getElementById('nextStep');
    
    switch(bookingState.currentStep) {
        case 1:
            nextBtn.disabled = !bookingState.selectedService;
            break;
        case 2:
            nextBtn.disabled = !bookingState.selectedDate || !bookingState.selectedTime;
            break;
        case 3:
            nextBtn.disabled = !isClientFormValid();
            break;
    }
}

function clearAllSelections() {
    // Limpiar selecciones de servicios
    document.querySelectorAll('.service-option').forEach(opt => {
        opt.classList.remove('selected');
    });
    
    // Limpiar calendario
    document.querySelectorAll('.calendar-day').forEach(day => {
        day.classList.remove('selected');
    });
    
    // Limpiar horarios
    document.getElementById('timeSlots').innerHTML = '<p>Selecciona una fecha para ver horarios disponibles</p>';
    
    // Limpiar formulario
    const form = document.getElementById('clientForm');
    if (form) form.reset();
}

function showError(message) {
    // Crear toast de error
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--error);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 3000;
        animation: slideInRight 0.3s ease;
    `;
    toast.innerHTML = `
        <i class="fas fa-exclamation-circle"></i>
        ${message}
    `;
    
    document.body.appendChild(toast);
    
    // Remover después de 5 segundos
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 5000);
}

// ========================================
// EVENT HANDLERS GLOBALES
// ========================================

function handleGlobalClicks(event) {
    const target = event.target;
    
    // Manejar clicks en botones "Reservar" de servicios
    if (target.closest('.servicio-card .btn')) {
        event.preventDefault();
        const card = target.closest('.servicio-card');
        const serviceName = card.querySelector('h3').textContent;
        const price = parseInt(card.dataset.price);
        const duration = parseInt(card.dataset.duration);
        
        selectService(serviceName, price, duration);
    }
    
    // Manejar click en botón "Reservar Turno" del hero
    if (target.classList.contains('btn-reservar') || target.onclick?.toString().includes('openBookingModal')) {
        event.preventDefault();
        openBookingModal();
    }
}

// ========================================
// FUNCIONES GLOBALES
// ========================================

// Hacer funciones disponibles globalmente
window.openBookingModal = openBookingModal;
window.closeBookingModal = closeBookingModal;
window.selectService = selectService;
window.selectTimeSlot = selectTimeSlot;

// ========================================
// ANIMACIONES CSS ADICIONALES
// ========================================

// Agregar animaciones CSS dinámicamente
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .error-toast {
        font-family: var(--font-secondary);
        font-size: 0.9rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }
`;
document.head.appendChild(style);

console.log('💅 Bella Estética - Sistema de Reservas completamente cargado');