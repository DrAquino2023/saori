/**
 * SISTEMA DE RESERVAS SAORI - JAVASCRIPT COMPLETO
 * Maneja todo el flujo de reservas desde frontend
 */

class SistemaReservas {
    constructor() {
        this.currentStep = 1;
        this.selectedService = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.currentMonth = new Date();
        this.clientData = {};
        this.reservaData = {};
        
        // Servicios se cargan desde API
        this.servicios = [];
        
        // Configuración de horarios (se puede configurar desde admin)
        this.horarios = {
            lunes: { inicio: '09:00', fin: '18:00', bloques: [] },
            martes: { inicio: '09:00', fin: '18:00', bloques: [] },
            miercoles: { inicio: '09:00', fin: '18:00', bloques: [] },
            jueves: { inicio: '09:00', fin: '18:00', bloques: [] },
            viernes: { inicio: '09:00', fin: '18:00', bloques: [] },
            sabado: { inicio: '09:00', fin: '16:00', bloques: [] },
            domingo: { activo: false }
        };
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.loadServicios();
        this.generateCalendar();
    }
    
    bindEvents() {
        // Modal controls
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal());
        
        // Step navigation
        document.getElementById('nextStep1').addEventListener('click', () => this.goToStep(2));
        document.getElementById('prevStep2').addEventListener('click', () => this.goToStep(1));
        document.getElementById('nextStep2').addEventListener('click', () => this.goToStep(3));
        document.getElementById('prevStep3').addEventListener('click', () => this.goToStep(2));
        document.getElementById('nextStep3').addEventListener('click', () => this.goToStep(4));
        document.getElementById('prevStep4').addEventListener('click', () => this.goToStep(3));
        
        // Calendar navigation
        document.getElementById('prevMonth').addEventListener('click', () => this.changeMonth(-1));
        document.getElementById('nextMonth').addEventListener('click', () => this.changeMonth(1));
        
        // Form validation
        this.bindFormValidation();
        
        // Final confirmation
        document.getElementById('confirmReserva').addEventListener('click', () => this.confirmReserva());
        
        // Success modal
        document.getElementById('closeSuccess').addEventListener('click', () => this.closeSuccessModal());
        
        // Close modal on outside click
        document.getElementById('reservaModal').addEventListener('click', (e) => {
            if (e.target.id === 'reservaModal') {
                this.closeModal();
            }
        });
    }
    
    openModal() {
        document.getElementById('reservaModal').style.display = 'block';
        document.body.style.overflow = 'hidden';
        this.goToStep(1);
    }
    
    closeModal() {
        document.getElementById('reservaModal').style.display = 'none';
        document.body.style.overflow = 'auto';
        this.resetForm();
    }
    
    resetForm() {
        this.currentStep = 1;
        this.selectedService = null;
        this.selectedDate = null;
        this.selectedTime = null;
        this.clientData = {};
        this.reservaData = {};
        
        // Reset UI
        document.querySelectorAll('.step').forEach(step => step.classList.remove('active'));
        document.querySelectorAll('.step-content').forEach(content => content.classList.remove('active'));
        document.getElementById('clientForm').reset();
        
        this.updateStepUI();
    }
    
    goToStep(step) {
        if (step < 1 || step > 4) return;
        
        this.currentStep = step;
        this.updateStepUI();
        this.updateStepContent();
    }
    
    updateStepUI() {
        // Update step indicators
        document.querySelectorAll('.step').forEach((stepEl, index) => {
            if (index < this.currentStep) {
                stepEl.classList.add('active');
            } else {
                stepEl.classList.remove('active');
            }
        });
        
        // Update step content
        document.querySelectorAll('.step-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`step${this.currentStep}`).classList.add('active');
    }
    
    updateStepContent() {
        switch(this.currentStep) {
            case 2:
                this.generateCalendar();
                break;
            case 4:
                this.updateSummary();
                break;
        }
    }
    
    async loadServicios() {
        const grid = document.querySelector('.servicios-grid');
        
        try {
            // Mostrar loading
            grid.innerHTML = '<div style="text-align: center; padding: 2rem;">Cargando servicios...</div>';
            
            // Cargar servicios desde API
            const response = await fetch('/api/services');
            if (!response.ok) {
                throw new Error('Error cargando servicios');
            }
            
            const serviciosDB = await response.json();
            
            // Convertir formato de BD a formato frontend
            this.servicios = serviciosDB.map(servicio => ({
                id: servicio.id,
                nombre: servicio.name,
                precio: Math.round(servicio.price_cents / 100), // Convertir centavos a pesos
                duracion: servicio.duration_min,
                descripcion: this.getDescripcionServicio(servicio.name)
            }));
            
            // Limpiar grid
            grid.innerHTML = '';
            
            // Renderizar servicios
            this.servicios.forEach(servicio => {
                const card = document.createElement('div');
                card.className = 'servicio-card';
                card.dataset.serviceId = servicio.id;
                
                card.innerHTML = `
                    <h4>${servicio.nombre}</h4>
                    <div class="price">$${servicio.precio.toLocaleString()}</div>
                    <div class="duration">${servicio.duracion} minutos</div>
                    <div class="description">${servicio.descripcion}</div>
                `;
                
                card.addEventListener('click', () => this.selectService(servicio));
                grid.appendChild(card);
            });
            
        } catch (error) {
            console.error('Error cargando servicios:', error);
            grid.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: #ff6b6b;">
                    <p>Error cargando servicios</p>
                    <button onclick="window.sistemaReservas.loadServicios()" 
                            style="padding: 0.5rem 1rem; background: #FF1493; color: white; border: none; border-radius: 5px; cursor: pointer;">
                        Reintentar
                    </button>
                </div>
            `;
        }
    }
    
    getDescripcionServicio(nombre) {
        // Descripciones personalizadas para cada servicio
        const descripciones = {
            'Glúteos y piernas: enfoque integral': 'Tratamiento completo para tonificar y reafirmar glúteos y piernas con tecnología avanzada',
            'Reafirmante Facial': 'Protocolo de reafirmación facial con radiofrecuencia y técnicas especializadas',
            'Perfilado de cejas': 'Diseño y perfilado profesional de cejas para realzar tu mirada',
            'Hydrapeeling+ fototerapia Led': 'Exfoliación profunda combinada con terapia de luz LED para renovación celular',
            'Anticelulitis EMS+ linfático': 'Combinación de drenaje linfático y electroestimulación para combatir la celulitis',
            'Plasma rico en plaquetas + vitaminas': 'Tratamiento regenerativo con plasma rico en plaquetas y vitaminas',
            'Vaporización con ozono + limpieza': 'Limpieza facial profunda con vapor de ozono y extracción de impurezas',
            'Peeling químico + alta frecuencia': 'Renovación celular con peeling químico y estimulación de colágeno',
            'Bblips - hidratación profunda': 'Hidratación intensiva con técnicas avanzadas para pieles secas'
        };
        
        return descripciones[nombre] || 'Tratamiento profesional de estética avanzada';
    }
    
    selectService(servicio) {
        // Remove previous selection
        document.querySelectorAll('.servicio-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Select current
        document.querySelector(`[data-service-id="${servicio.id}"]`).classList.add('selected');
        this.selectedService = servicio;
        
        // Enable next button
        document.getElementById('nextStep1').disabled = false;
    }
    
    generateCalendar() {
        const calendar = document.getElementById('calendar');
        const currentMonthEl = document.getElementById('currentMonth');
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
        currentMonthEl.textContent = this.currentMonth.toLocaleDateString('es-ES', { 
            month: 'long', 
            year: 'numeric' 
        });
        
        // Clear calendar
        calendar.innerHTML = '';
        
        // Create header
        const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        daysOfWeek.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-header-day';
            dayEl.textContent = day;
            calendar.appendChild(dayEl);
        });
        
        // Get first day of month and number of days
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        // Add empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day empty';
            calendar.appendChild(dayEl);
        }
        
        // Add days of month
        for (let day = 1; day <= daysInMonth; day++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.textContent = day;
            
            const currentDate = new Date(year, month, day);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            // Disable past dates
            if (currentDate < today) {
                dayEl.classList.add('disabled');
            } else {
                dayEl.addEventListener('click', () => this.selectDate(currentDate));
            }
            
            calendar.appendChild(dayEl);
        }
    }
    
    async selectDate(date) {
        // Remove previous selection
        document.querySelectorAll('.calendar-day').forEach(day => {
            day.classList.remove('selected');
        });
        
        // Select current
        event.target.classList.add('selected');
        this.selectedDate = date;
        
        // Load available time slots
        await this.loadTimeSlots(date);
        
        // Show time slots
        document.getElementById('timeSlots').style.display = 'block';
    }
    
    async loadTimeSlots(date) {
        try {
            const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
            const response = await fetch(`/api/reservations?date=${dateStr}&resource_id=1`);
            
            if (!response.ok) {
                throw new Error('Error loading reservations');
            }
            
            const reservations = await response.json();
            
            // Generate time slots based on business hours
            const slots = this.generateTimeSlots();
            
            // Mark unavailable slots
            const availableSlots = slots.map(slot => ({
                ...slot,
                available: !this.isSlotOccupied(slot, reservations)
            }));
            
            this.renderTimeSlots(availableSlots);
            
        } catch (error) {
            console.error('Error loading time slots:', error);
            document.getElementById('availableSlots').innerHTML = 
                '<p>Error cargando horarios disponibles</p>';
        }
    }
    
    generateTimeSlots() {
        const slots = [];
        const startHour = 9;
        const endHour = 18;
        
        for (let hour = startHour; hour < endHour; hour++) {
            slots.push({ time: `${hour.toString().padStart(2, '0')}:00` });
        }
        
        return slots;
    }
    
    isSlotOccupied(slot, reservations) {
        const slotTime = new Date(`${this.selectedDate.toDateString()} ${slot.time}`);
        
        return reservations.some(reservation => {
            const reservationStart = new Date(reservation.fecha_hora);
            const reservationEnd = new Date(reservationStart.getTime() + 2 * 60 * 60 * 1000); // 2 hours
            
            return slotTime >= reservationStart && slotTime < reservationEnd;
        });
    }
    
    renderTimeSlots(slots) {
        const slotsContainer = document.getElementById('availableSlots');
        slotsContainer.innerHTML = '';
        
        if (slots.length === 0) {
            slotsContainer.innerHTML = '<p>No hay horarios disponibles para este día.</p>';
            return;
        }
        
        slots.forEach(slot => {
            const slotEl = document.createElement('div');
            slotEl.className = `time-slot ${!slot.available ? 'disabled' : ''}`;
            slotEl.textContent = slot.time;
            
            if (slot.available) {
                slotEl.addEventListener('click', () => this.selectTimeSlot(slot));
            }
            
            slotsContainer.appendChild(slotEl);
        });
    }
    
    selectTimeSlot(slot) {
        // Remove previous selection
        document.querySelectorAll('.time-slot').forEach(slotEl => {
            slotEl.classList.remove('selected');
        });
        
        // Select current
        event.target.classList.add('selected');
        this.selectedTime = slot;
        
        // Enable next button
        document.getElementById('nextStep2').disabled = false;
    }
    
    changeMonth(direction) {
        this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
        this.generateCalendar();
        
        // Clear time slots
        document.getElementById('timeSlots').style.display = 'none';
        this.selectedDate = null;
        this.selectedTime = null;
        document.getElementById('nextStep2').disabled = true;
    }
    
    bindFormValidation() {
        const form = document.getElementById('clientForm');
        const inputs = form.querySelectorAll('input[required], textarea[required]');
        const nextBtn = document.getElementById('nextStep3');
        
        inputs.forEach(input => {
            input.addEventListener('input', () => this.validateForm());
        });
        
        document.getElementById('terminos').addEventListener('change', () => this.validateForm());
    }
    
    validateForm() {
        const form = document.getElementById('clientForm');
        const formData = new FormData(form);
        const nextBtn = document.getElementById('nextStep3');
        
        // Check required fields
        const nombre = formData.get('nombre');
        const email = formData.get('email');
        const telefono = formData.get('telefono');
        const terminos = formData.get('terminos');
        
        const isValid = nombre && email && telefono && terminos;
        nextBtn.disabled = !isValid;
        
        if (isValid) {
            this.clientData = {
                nombre: nombre,
                email: email,
                telefono: telefono,
                edad: formData.get('edad') || null,
                observaciones: formData.get('observaciones') || ''
            };
        }
    }
    
    updateSummary() {
        if (!this.selectedService || !this.selectedDate || !this.selectedTime) return;
        
        // Service
        document.getElementById('summaryService').textContent = this.selectedService.nombre;
        
        // Date
        const dateOptions = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        document.getElementById('summaryDate').textContent = 
            this.selectedDate.toLocaleDateString('es-ES', dateOptions);
        
        // Time
        document.getElementById('summaryTime').textContent = this.selectedTime.time + ' hs';
        
        // Client
        document.getElementById('summaryClient').textContent = this.clientData.nombre;
        
        // Prices
        const total = this.selectedService.precio;
        const deposit = Math.ceil(total * 0.5); // Usar Math.ceil para redondear hacia arriba
        
        document.getElementById('summaryTotal').textContent = `$${total.toLocaleString()}`;
        document.getElementById('summaryDeposit').textContent = `$${deposit.toLocaleString()}`;
        
        // Store for later use
        this.reservaData = {
            servicio: this.selectedService,
            fecha: this.selectedDate,
            hora: this.selectedTime,
            cliente: this.clientData,
            total: total,
            seña: deposit
        };
    }
    
    formatDateTimeForAPI(fecha, hora) {
        // fecha: Date object, hora: string "HH:MM"
        const [hours, minutes] = hora.split(':');
        const dateTime = new Date(fecha);
        dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        
        // Formatear como 'YYYY-MM-DD HH:MM:SS'
        const pad = (n) => String(n).padStart(2, '0');
        const yyyy = dateTime.getFullYear();
        const mm = pad(dateTime.getMonth() + 1);
        const dd = pad(dateTime.getDate());
        const HH = pad(dateTime.getHours());
        const MM = pad(dateTime.getMinutes());
        const SS = '00';
        
        return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
    }
    
    async confirmReserva() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
        
        try {
            loadingOverlay.style.display = 'block';
            
            if (paymentMethod === 'mercadopago') {
                await this.processPayment();
            } else {
                await this.saveReservation();
            }
            
        } catch (error) {
            console.error('Error confirming reservation:', error);
            alert('Error al procesar la reserva. Por favor intenta nuevamente.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
    
    async processPayment() {
        // Create MercadoPago preference
        const response = await fetch('/api/create-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reserva: this.reservaData,
                amount: this.reservaData.seña,
                description: `Seña - ${this.reservaData.servicio.nombre}`
            })
        });
        
        if (!response.ok) {
            throw new Error('Error creating payment');
        }
        
        const data = await response.json();
        
        // Redirect to MercadoPago
        window.location.href = data.init_point;
    }
    
    async saveReservation() {
        const response = await fetch('/api/reservations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: this.clientData.nombre,
                email: this.clientData.email,
                phone: this.clientData.telefono,
                service_id: this.selectedService.id,
                resource_id: 1, // Por ahora siempre 1, después lo haremos dinámico
                start_time: this.formatDateTimeForAPI(this.selectedDate, this.selectedTime.time),
                payment_method: 'efectivo'
            })
        });
        
        if (!response.ok) {
            throw new Error('Error saving reservation');
        }
        
        const data = await response.json();
        this.showSuccessModal(data.reservation_id);
    }
    
    showSuccessModal(reservationId) {
        document.getElementById('reservaNumber').textContent = reservationId;
        document.getElementById('successModal').style.display = 'block';
        this.closeModal();
    }
    
    closeSuccessModal() {
        document.getElementById('successModal').style.display = 'none';
    }
}

// Initialize system when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.sistemaReservas = new SistemaReservas();
    
    // Add event listeners to open modal buttons
    document.querySelectorAll('[href="#reservar"], .btn-primary, .btn-service').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.sistemaReservas.openModal();
        });
    });
});

// Handle MercadoPago return
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('payment') === 'success') {
    document.addEventListener('DOMContentLoaded', () => {
        const reservationId = urlParams.get('reservation_id');
        if (reservationId) {
            setTimeout(() => {
                window.sistemaReservas.showSuccessModal(reservationId);
            }, 1000);
        }
    });
}
