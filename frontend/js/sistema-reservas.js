// === Config de API (una sola fuente de verdad) ===
(function () {
  if (!window.API_BASE) {
    window.API_BASE =
      location.hostname === "localhost" ? "http://localhost:3001/api" : "/api";
  }
  console.info("[Saori] API_BASE =", window.API_BASE);
})();

// === Formateador $ARS ===
const fmtARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

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
    this.servicios = [];

    // ConfiguraciÃ³n de horarios (se puede configurar desde admin)
    this.horarios = {
      lunes: { inicio: "09:00", fin: "18:00", bloques: [] },
      martes: { inicio: "09:00", fin: "18:00", bloques: [] },
      miercoles: { inicio: "09:00", fin: "18:00", bloques: [] },
      jueves: { inicio: "09:00", fin: "18:00", bloques: [] },
      viernes: { inicio: "09:00", fin: "18:00", bloques: [] },
      sabado: { inicio: "09:00", fin: "16:00", bloques: [] },
      domingo: { activo: false },
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
    document
      .getElementById("closeModal")
      .addEventListener("click", () => this.closeModal());

    // Step navigation
    document
      .getElementById("nextStep1")
      .addEventListener("click", () => this.goToStep(2));
    document
      .getElementById("prevStep2")
      .addEventListener("click", () => this.goToStep(1));
    document
      .getElementById("nextStep2")
      .addEventListener("click", () => this.goToStep(3));
    document
      .getElementById("prevStep3")
      .addEventListener("click", () => this.goToStep(2));
    document
      .getElementById("nextStep3")
      .addEventListener("click", () => this.goToStep(4));
    document
      .getElementById("prevStep4")
      .addEventListener("click", () => this.goToStep(3));

    // Calendar navigation
    document
      .getElementById("prevMonth")
      .addEventListener("click", () => this.changeMonth(-1));
    document
      .getElementById("nextMonth")
      .addEventListener("click", () => this.changeMonth(1));

    // Form validation
    this.bindFormValidation();

    // Final confirmation
    document
      .getElementById("confirmReserva")
      .addEventListener("click", () => this.confirmReserva());

    // Success modal
    document
      .getElementById("closeSuccess")
      .addEventListener("click", () => this.closeSuccessModal());

    // Close modal on outside click
    document.getElementById("reservaModal").addEventListener("click", (e) => {
      if (e.target.id === "reservaModal") {
        this.closeModal();
      }
    });
  }

  openModal() {
    document.getElementById("reservaModal").style.display = "block";
    document.body.style.overflow = "hidden";
    this.goToStep(1);
  }

  closeModal() {
    document.getElementById("reservaModal").style.display = "none";
    document.body.style.overflow = "auto";
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
    document
      .querySelectorAll(".step")
      .forEach((step) => step.classList.remove("active"));
    document
      .querySelectorAll(".step-content")
      .forEach((content) => content.classList.remove("active"));
    document.getElementById("clientForm").reset();

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
    document.querySelectorAll(".step").forEach((stepEl, index) => {
      if (index < this.currentStep) {
        stepEl.classList.add("active");
      } else {
        stepEl.classList.remove("active");
      }
    });

    // Update step content
    document.querySelectorAll(".step-content").forEach((content) => {
      content.classList.remove("active");
    });
    document.getElementById(`step${this.currentStep}`).classList.add("active");
  }

  updateStepContent() {
    switch (this.currentStep) {
      case 2:
        this.generateCalendar();
        break;
      case 4:
        this.updateSummary();
        break;
    }
  }

  async loadServicios() {
    const grid = document.querySelector(".servicios-grid");
    const btnContinuar = document.getElementById("nextStep1");

    grid.innerHTML = `<div class="loading" style="margin:20px 0;">Cargando servicios...</div>`;
    btnContinuar.disabled = true;

    try {
      const resp = await fetch(`${window.API_BASE}/services`, {
        method: "GET",
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const rows = await resp.json(); // [{id,name,duration_min,price_cents}, ...]

      // Formateador $ARS
      const fmtARS = new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        maximumFractionDigits: 0,
      });

      // Mapear BD → modelo UI
      this.servicios = rows.map((r) => ({
        id: r.id,
        nombre: r.name,
        duracion: Number(r.duration_min) || 60,
        precio: Math.round((r.price_cents || 0) / 100),
        descripcion: r.description || this.getDescripcionServicio(r.name) || "",
      }));

      // Pintar
      grid.innerHTML = "";
      this.servicios.forEach((servicio) => {
        const card = document.createElement("div");
        card.className = "servicio-card";
        card.dataset.serviceId = servicio.id;
        card.innerHTML = `
        <h4>${servicio.nombre}</h4>
        <div class="price">${fmtARS.format(servicio.precio)}</div>
        <div class="duration">${servicio.duracion} minutos</div>
        <div class="description">${servicio.descripcion}</div>
      `;
        card.addEventListener("click", () => this.selectService(servicio));
        grid.appendChild(card);
      });

      btnContinuar.disabled = true; // se habilita recién al elegir servicio
    } catch (err) {
      console.error("Error cargando servicios:", err);
      grid.innerHTML = `
      <div style="color:#c00; margin:16px 0;">Error cargando servicios</div>
      <button id="retryServicios" class="btn btn-secondary">Reintentar</button>
    `;
      document
        .getElementById("retryServicios")
        ?.addEventListener("click", () => this.loadServicios());
    }
  }

  /*
  async loadServicios() {
    const grid = document.querySelector(".servicios-grid");

    try {
      // Mostrar loading
      grid.innerHTML =
        '<div style="text-align: center; padding: 2rem;">Cargando servicios...</div>';

      // Cargar servicios desde API
      const response = await fetch("/api/services");
      if (!response.ok) {
        throw new Error("Error cargando servicios");
      }

      const serviciosDB = await response.json();

      // Convertir formato de BD a formato frontend
      this.servicios = serviciosDB.map((servicio) => ({
        id: servicio.id,
        nombre: servicio.name,
        precio: Math.round(servicio.price_cents / 100), // Convertir centavos a pesos
        duracion: servicio.duration_min,
        descripcion: this.getDescripcionServicio(servicio.name),
      }));

      // Limpiar grid
      grid.innerHTML = "";

      // Renderizar servicios
      this.servicios.forEach((servicio) => {
        const card = document.createElement("div");
        card.className = "servicio-card";
        card.dataset.serviceId = servicio.id;

        card.innerHTML = `
                <h4>${servicio.nombre}</h4>
                <div class="price">$${servicio.precio.toLocaleString()}</div>
                <div class="duration">${servicio.duracion} minutos</div>
                <div class="description">${servicio.descripcion}</div>
            `;

        card.addEventListener("click", () => this.selectService(servicio));
        grid.appendChild(card);
      });
    } catch (error) {
      console.error("Error cargando servicios:", error);
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
*/
  getDescripcionServicio(nombre) {
    // Descripciones personalizadas para cada servicio
    const descripciones = {
      "Glúteos y piernas: enfoque integral":
        "Tratamiento completo para tonificar y reafirmar glúteos y piernas con tecnología avanzada",
      "Reafirmante Facial":
        "Protocolo de reafirmación facial con radiofrecuencia y técnicas especializadas",
      "Perfilado de cejas":
        "Diseño y perfilado profesional de cejas para realzar tu mirada",
      "Hydrapeeling+ fototerapia Led":
        "Exfoliación profunda combinada con terapia de luz LED para renovación celular",
      "Anticelulitis EMS+ linfático":
        "Combinación de drenaje linfático y electroestimulación para combatir la celulitis",
      "Plasma rico en plaquetas + vitaminas":
        "Tratamiento regenerativo con plasma rico en plaquetas y vitaminas",
      "Vaporización con ozono + limpieza":
        "Limpieza facial profunda con vapor de ozono y extracción de impurezas",
      "Peeling químico + alta frecuencia":
        "Renovación celular con peeling químico y estimulación de colágeno",
      "Bblips - hidratación profunda":
        "Hidratación intensiva con técnicas avanzadas para pieles secas",
    };

    return (
      descripciones[nombre] || "Tratamiento profesional de estética avanzada"
    );
  }

  selectService(servicio) {
    // Remove previous selection
    document.querySelectorAll(".servicio-card").forEach((card) => {
      card.classList.remove("selected");
    });

    // Select current
    document
      .querySelector(`[data-service-id="${servicio.id}"]`)
      .classList.add("selected");
    this.selectedService = servicio;

    // Enable next button
    document.getElementById("nextStep1").disabled = false;
  }

  generateCalendar() {
    const calendar = document.getElementById("calendar");
    const monthTitle = document.getElementById("currentMonth");

    // Clear calendar
    calendar.innerHTML = "";

    // Set month title
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];
    monthTitle.textContent = `${
      monthNames[this.currentMonth.getMonth()]
    } ${this.currentMonth.getFullYear()}`;

    // Days of week headers
    const dayHeaders = ["Dom", "Lun", "Mar", "MiÃ©", "Jue", "Vie", "SÃ¡b"];
    dayHeaders.forEach((day) => {
      const header = document.createElement("div");
      header.className = "calendar-header";
      header.textContent = day;
      calendar.appendChild(header);
    });

    // Calculate calendar days
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstDayWeek = firstDay.getDay();
    const today = new Date();

    // Add previous month days
    for (let i = firstDayWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      const dayEl = this.createDayElement(prevDate, true, false);
      calendar.appendChild(dayEl);
    }

    // Add current month days
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, month, day);
      const isPast = date < today.setHours(0, 0, 0, 0);
      const isWeekend = date.getDay() === 0; // Solo domingo cerrado
      const dayEl = this.createDayElement(date, false, isPast || isWeekend);
      calendar.appendChild(dayEl);
    }

    // Add next month days to fill grid
    const totalCells = calendar.children.length - 7; // Subtract headers
    const remainingCells = 42 - totalCells; // 6 rows * 7 days
    for (let day = 1; day <= remainingCells; day++) {
      const nextDate = new Date(year, month + 1, day);
      const dayEl = this.createDayElement(nextDate, true, false);
      calendar.appendChild(dayEl);
    }
  }

  createDayElement(date, otherMonth, disabled) {
    const dayEl = document.createElement("div");
    dayEl.className = "calendar-day";
    dayEl.textContent = date.getDate();

    if (otherMonth) {
      dayEl.classList.add("other-month");
    }

    if (disabled) {
      dayEl.classList.add("disabled");
    } else {
      // Pasar el elemento explícitamente para evitar depender de la variable global `event`
      dayEl.addEventListener("click", (e) => this.selectDate(date, e.currentTarget));
    }

    return dayEl;
  }

  selectDate(date, el) {
    // Remove previous selection
    document.querySelectorAll(".calendar-day").forEach((day) => {
      day.classList.remove("selected");
    });

    // Select the clicked element (received as parameter)
    if (el && el.classList) el.classList.add("selected");
    this.selectedDate = date;

    // Load available time slots
    this.loadTimeSlots(date);
  }

  async loadTimeSlots(date) {
    const slotsContainer = document.getElementById("availableSlots");
    const timeSlots = document.getElementById("timeSlots");

    // Show loading
    slotsContainer.innerHTML =
      '<div class="loading">Cargando horarios...</div>';
    timeSlots.style.display = "block";

    try {
      // Get day of week (0 = Sunday, 1 = Monday, etc.) and config
      const dayOfWeek = date.getDay();
      const dayNames = [
        "domingo",
        "lunes",
        "martes",
        "miercoles",
        "jueves",
        "viernes",
        "sabado",
      ];
      const dayName = dayNames[dayOfWeek];

      // Check if day is active. Si 'activo' es false explicitamente, está cerrado.
      const dayConfig = this.horarios[dayName];
      if (!dayConfig || dayConfig.activo === false) {
        slotsContainer.innerHTML =
          "<p>No hay horarios disponibles para este dÃ­a.</p>";
        return;
      }

      // Generate time slots
      const slots = await this.generateTimeSlots(date, this.horarios[dayName]);
      this.renderTimeSlots(slots);
    } catch (error) {
      console.error("Error loading time slots:", error);
      slotsContainer.innerHTML =
        "<p>Error al cargar horarios. Intenta nuevamente.</p>";
    }
  }

  async generateTimeSlots(date, dayConfig) {
    const slots = [];
    const [startHour, startMinute] = dayConfig.inicio.split(":").map(Number);
    const [endHour, endMinute] = dayConfig.fin.split(":").map(Number);

    let currentTime = new Date(date);
    currentTime.setHours(startHour, startMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endHour, endMinute, 0, 0);

    // Get existing reservations for this date
    const existingReservations = await this.getReservationsForDate(date);

    while (currentTime < endTime) {
      const timeString = currentTime.toTimeString().substring(0, 5);
      const isAvailable = !this.isTimeSlotOccupied(
        currentTime,
        existingReservations
      );

      slots.push({
        time: timeString,
        datetime: new Date(currentTime),
        available: isAvailable,
      });

      // Next slot (1 hour later)
      currentTime.setHours(currentTime.getHours() + 1);
    }

    return slots;
  }

  async getReservationsForDate(date) {
    try {
      const response = await fetch(
        `${window.API_BASE}/reservations?date=${
          date.toISOString().split("T")[0]
        }&resource_id=1`
      );

      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error("Error fetching reservations:", error);
    }
    return [];
  }

  isTimeSlotOccupied(slotTime, reservations) {
    return reservations.some((reservation) => {
      const reservationStart = new Date(reservation.fecha_hora);
      const reservationEnd = new Date(
        reservationStart.getTime() + 2 * 60 * 60 * 1000
      ); // 2 hours

      return slotTime >= reservationStart && slotTime < reservationEnd;
    });
  }

  renderTimeSlots(slots) {
    const slotsContainer = document.getElementById("availableSlots");
    slotsContainer.innerHTML = "";

    if (slots.length === 0) {
      slotsContainer.innerHTML =
        "<p>No hay horarios disponibles para este dÃ­a.</p>";
      return;
    }

    slots.forEach((slot) => {
      const slotEl = document.createElement("div");
      slotEl.className = `time-slot ${!slot.available ? "disabled" : ""}`;
      slotEl.textContent = slot.time;

      if (slot.available) {
        // Pasar el elemento al handler para evitar usar `event` global
        slotEl.addEventListener("click", (e) => this.selectTimeSlot(slot, e.currentTarget));
      }

      slotsContainer.appendChild(slotEl);
    });
  }

  selectTimeSlot(slot, el) {
    // Remove previous selection
    document.querySelectorAll(".time-slot").forEach((slotEl) => {
      slotEl.classList.remove("selected");
    });

    // Select the clicked element
    if (el && el.classList) el.classList.add("selected");
    this.selectedTime = slot;

    // Enable next button
    document.getElementById("nextStep2").disabled = false;
  }

  changeMonth(direction) {
    this.currentMonth.setMonth(this.currentMonth.getMonth() + direction);
    this.generateCalendar();

    // Clear time slots
    document.getElementById("timeSlots").style.display = "none";
    this.selectedDate = null;
    this.selectedTime = null;
    document.getElementById("nextStep2").disabled = true;
  }

  bindFormValidation() {
    const form = document.getElementById("clientForm");
    const inputs = form.querySelectorAll("input[required], textarea[required]");
    const nextBtn = document.getElementById("nextStep3");

    inputs.forEach((input) => {
      input.addEventListener("input", () => this.validateForm());
    });

    document
      .getElementById("terminos")
      .addEventListener("change", () => this.validateForm());
  }

  validateForm() {
    const form = document.getElementById("clientForm");
    const formData = new FormData(form);
    const nextBtn = document.getElementById("nextStep3");

    // Check required fields
    const nombre = formData.get("nombre");
    const email = formData.get("email");
    const telefono = formData.get("telefono");
    const terminos = formData.get("terminos");

    const isValid = nombre && email && telefono && terminos;
    nextBtn.disabled = !isValid;

    if (isValid) {
      this.clientData = {
        nombre: nombre,
        email: email,
        telefono: telefono,
        edad: formData.get("edad") || null,
        observaciones: formData.get("observaciones") || "",
      };
    }
  }

  updateSummary() {
    if (!this.selectedService || !this.selectedDate || !this.selectedTime)
      return;

    // Service
    document.getElementById("summaryService").textContent =
      this.selectedService.nombre;

    // Date
    const dateOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    document.getElementById("summaryDate").textContent =
      this.selectedDate.toLocaleDateString("es-ES", dateOptions);

    // Time
    document.getElementById("summaryTime").textContent =
      this.selectedTime.time + " hs";

    // Client
    document.getElementById("summaryClient").textContent =
      this.clientData.nombre;

    // Prices
    const total = this.selectedService.precio;
    const deposit = Math.ceil(total * 0.5); // Usar Math.ceil para redondear hacia arriba

    document.getElementById(
      "summaryTotal"
    ).textContent = `$${total.toLocaleString()}`;
    document.getElementById(
      "summaryDeposit"
    ).textContent = `$${deposit.toLocaleString()}`;

    // Store for later use
    this.reservaData = {
      servicio: this.selectedService,
      fecha: this.selectedDate,
      hora: this.selectedTime,
      cliente: this.clientData,
      total: total,
      seña: deposit,
    };
  }
  formatDateTimeForAPI(fecha, hora) {
    // fecha: Date object, hora: string "HH:MM"
    const [hours, minutes] = hora.split(":");
    const dateTime = new Date(fecha);
    dateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    // Formatear como 'YYYY-MM-DD HH:MM:SS'
    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = dateTime.getFullYear();
    const mm = pad(dateTime.getMonth() + 1);
    const dd = pad(dateTime.getDate());
    const HH = pad(dateTime.getHours());
    const MM = pad(dateTime.getMinutes());
    const SS = "00";

    return `${yyyy}-${mm}-${dd} ${HH}:${MM}:${SS}`;
  }

  async confirmReserva() {
    const paymentMethod = document.querySelector(
      'input[name="paymentMethod"]:checked'
    ).value;

    // Mostrar loading
    document.getElementById("loadingOverlay").style.display = "block";

    try {
      // PASO 1: Si es MercadoPago, procesar pago primero
      if (paymentMethod === "mercadopago") {
        // Crear preferencia de pago
        const paymentData = {
          service: this.selectedService.nombre,
          amount: Math.round(this.selectedService.precio * 0.5), // 50% de seña
          customer: {
            name: this.clientData.nombre,
            email: this.clientData.email,
            phone: this.clientData.telefono,
          },
        };

        const paymentResponse = await fetch(
          `${window.API_BASE}/create-payment`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paymentData),
          }
        );

        if (!paymentResponse.ok) throw new Error("Error creando pago");

        const payment = await paymentResponse.json();

        // Si hay URL de pago real, redirigir a MercadoPago
        if (payment.init_point && payment.init_point !== "#") {
          // Guardar datos temporalmente
          localStorage.setItem(
            "pendingReservation",
            JSON.stringify({
              ...this.reservaData,
              paymentId: payment.preferenceId,
            })
          );

          // Redirigir a MercadoPago
          window.location.href = payment.init_point;
          return; // Detener aquí, la reserva se creará al volver
        }
      }

      // PASO 2: Crear la reserva con estado según método de pago
      const reservationData = {
        ...this.reservaData,
        status: paymentMethod === "efectivo" ? "pending" : "confirmed",
        payment_method: paymentMethod,
        deposit_required: Math.round(this.selectedService.precio * 0.5),
      };

      const response = await fetch(`${window.API_BASE}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reservationData),
      });

      if (!response.ok) throw new Error("Error creando reserva");

      const result = await response.json();

      // Ocultar loading
      document.getElementById("loadingOverlay").style.display = "none";

      // Mostrar mensaje según método de pago
      if (paymentMethod === "efectivo") {
        // Mostrar modal con instrucciones para pago en efectivo
        this.showCashPaymentModal(result);
      } else {
        // Mostrar éxito normal
        this.showSuccessModal(result);
      }
    } catch (error) {
      console.error("Error:", error);
      document.getElementById("loadingOverlay").style.display = "none";
      alert("Error procesando la reserva. Por favor intenta nuevamente.");
    }
  }

  // Agregar nueva función para mostrar modal de pago en efectivo
  showCashPaymentModal(result) {
    const modal = document.getElementById("successModal");
    const content = modal.querySelector(".success-content");

    content.innerHTML = `
        <div class="success-icon" style="color: #FFA500;">
            <i class="fas fa-exclamation-circle"></i>
        </div>
        <h3>¡Reserva Pendiente de Pago!</h3>
        <p>Tu turno está PRE-RESERVADO por 24 horas.</p>
        <div class="success-details">
            <p><strong>Número de reserva:</strong> ${
              result.reservation_id || result.reservationId
            }</p>
            <p><strong>Seña a pagar:</strong> ${fmtARS.format(
              this.selectedService.precio * 0.5
            )}</p>
            <p style="color: #FF6B6B;"><strong>IMPORTANTE:</strong></p>
            <ul>
                <li>Debes abonar la seña en las próximas 24 horas</li>
                <li>Puedes pagar en efectivo en nuestro local</li>
                <li>Sin el pago de la seña, tu reserva será cancelada automáticamente</li>
            </ul>
            <p><strong>Dirección:</strong> ${
              process.env.BUSINESS_ADDRESS || "Tu dirección aquí"
            }</p>
        </div>
        <button id="closeSuccess" class="btn-primary">Entendido</button>
    `;

    modal.style.display = "block";
    document
      .getElementById("closeSuccess")
      .addEventListener("click", () => this.closeSuccessModal());
  }

  async processPayment() {
    // Monto de seña calculado por si falta en reservaData
    const deposito =
      this?.reservaData?.seña != null
        ? this.reservaData.seña
        : Math.round((this?.selectedService?.precio || 0) * 0.5);

    try {
      const resp = await fetch(window.API_BASE + "/create-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name: this.clientData.nombre,
          email: this.clientData.email,
          phone: this.clientData.telefono,
          service_id: this.selectedService.id,
          resource_id: 1, // Por ahora siempre 1, después lo haremos dinámico
          start_time: this.formatDateTimeForAPI(
            this.selectedDate,
            this.selectedTime.time
          ),
          payment_method: "efectivo",
        }),
      });

      // Intentar parsear JSON aunque no sea 200
      let data = null;
      try {
        data = await resp.json();
      } catch (_) {
        /* no-op */
      }

      const url = data?.init_point || data?.sandbox_init_point || "";
      const pareceURL = typeof url === "string" && /^(https?:)?\/\//.test(url);

      if (resp.ok && pareceURL) {
        // Flujo real: redirigir a pasarela
        window.location.href = url;
        return;
      }

      // Si el stub devuelve "#" o status no-OK, continuar en modo fallback
      console.warn("[Saori] Pago en modo stub/indisponible:", {
        status: resp.status,
        data,
      });
    } catch (e) {
      // Error de red o parseo: continuar en modo fallback
      console.warn(
        "[Saori] create-payment falló; uso fallback a reserva local:",
        e
      );
    }

    // Fallback: crear la reserva localmente y mostrar éxito
    await this.saveReservation();
  }

  async saveReservation() {
    // Helper → 'YYYY-MM-DD HH:MM:SS' en hora local
    const toLocalSQL = (dt) => {
      const d = new Date(dt);
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
    };

    // Mapear datos del wizard al payload que espera el backend
    const nombre = this?.clientData?.nombre || "";
    const email = this?.clientData?.email || "";
    const telefono = this?.clientData?.telefono || "";
    const serviceId = this?.selectedService?.id;
    // Mientras no haya selector de recurso/cabina, usar un recurso fijo:
    const resourceId = 1;

    // Hora seleccionada
    const startDate = this?.selectedTime?.datetime || this?.selectedDate;
    const startSQL = toLocalSQL(startDate);

    const payload = {
      name: nombre,
      email: email,
      phone: telefono,
      service_id: serviceId,
      resource_id: resourceId,
      start_time: startSQL,
    };

    const response = await fetch(window.API_BASE + "/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Log útil si hay 4xx/5xx
      let txt = "";
      try {
        txt = await response.text();
      } catch {}
      console.error("POST /api/reservations falló", response.status, txt);
      throw new Error("Error saving reservation");
    }

    const data = await response.json();
    // El backend puede devolver snake_case o camelCase
    const rid = data.reservation_id || data.reservationId;
    this.showSuccessModal(rid);
  }

  showSuccessModal(reservationId) {
    document.getElementById("reservaNumber").textContent = reservationId;
    document.getElementById("successModal").style.display = "block";
    this.closeModal();
  }

  closeSuccessModal() {
    document.getElementById("successModal").style.display = "none";
  }
}

// Initialize system when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.sistemaReservas = new SistemaReservas();

  // Add event listeners to open modal buttons
  document
    .querySelectorAll('[href="#reservar"], .btn-primary, .btn-service')
    .forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        window.sistemaReservas.openModal();
      });
    });
});

// Handle MercadoPago return
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get("payment") === "success") {
  document.addEventListener("DOMContentLoaded", () => {
    const reservationId = urlParams.get("reservation_id");
    if (reservationId) {
      setTimeout(() => {
        window.sistemaReservas.showSuccessModal(reservationId);
      }, 1000);
    }
  });
}
