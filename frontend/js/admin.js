/**
 * PANEL DE ADMINISTRACIÓN - JAVASCRIPT
 * Maneja toda la funcionalidad del panel admin
 */

class AdminPanel {
    constructor() {
        this.currentSection = 'dashboard';
        this.reservas = [];
        this.servicios = [];
        this.horarios = [];
        this.stats = {};
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.setDefaultDate();
        this.loadDashboard();
    }
    
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);
            });
        });
        
        // Modal close events
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
        
        // Service form
        document.getElementById('serviceForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveService();
        });
        
        // Filter events
        document.getElementById('reservasFilterDate').addEventListener('change', () => this.loadReservas());
        document.getElementById('reservasFilterEstado').addEventListener('change', () => this.loadReservas());
    }
    
    setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('filterDate').value = today;
        document.getElementById('reservasFilterDate').value = today;
    }
    
    showSection(sectionName) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-section="${sectionName}"]`).classList.add('active');
        
        // Show content
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(sectionName).classList.add('active');
        
        this.currentSection = sectionName;
        
        // Load section data
        switch(sectionName) {
            case 'dashboard':
                this.loadDashboard();
                break;
            case 'reservas':
                this.loadReservas();
                break;
            case 'horarios':
                this.loadHorarios();
                break;
            case 'servicios':
                this.loadServicios();
                break;
        }
    }
    
    async loadDashboard() {
        try {
            const date = document.getElementById('filterDate').value;
            
            // Load stats
            await this.loadStats(date);
            
            // Load today's reservations
            const response = await fetch(`/api/admin/reservas?fecha=${date}`);
            if (!response.ok) throw new Error('Error loading reservations');
            
            const reservas = await response.json();
            this.renderDashboardReservas(reservas);
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Error cargando el dashboard');
        }
    }
    
    async loadStats(date) {
        try {
            const response = await fetch(`/api/admin/reservas?fecha=${date}`);
            if (!response.ok) throw new Error('Error loading stats');
            
            const reservas = await response.json();
            
            const stats = {
                total: reservas.length,
                ingresos: reservas.reduce((sum, r) => sum + parseFloat(r.precio_total || 0), 0),
                pendientes: reservas.filter(r => r.estado === 'pendiente').length,
                canceladas: reservas.filter(r => r.estado === 'cancelada').length
            };
            
            this.updateStatsDisplay(stats);
            
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    updateStatsDisplay(stats) {
        document.getElementById('totalReservas').textContent = stats.total;
        document.getElementById('ingresosDia').textContent = `$${stats.ingresos.toLocaleString()}`;
        document.getElementById('reservasPendientes').textContent = stats.pendientes;
        document.getElementById('reservasCanceladas').textContent = stats.canceladas;
    }
    
    renderDashboardReservas(reservas) {
        const container = document.getElementById('dashboardReservas');
        
        if (reservas.length === 0) {
            container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #999;">No hay reservas para esta fecha.</p>';
            return;
        }
        
        const table = `
            <table>
                <thead>
                    <tr>
                        <th>Hora</th>
                        <th>Cliente</th>
                        <th>Servicio</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservas.map(reserva => this.renderReservaRow(reserva)).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }
    
    renderReservaRow(reserva) {
        const fecha = new Date(reserva.fecha_hora);
        const hora = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <tr>
                <td><strong>${hora}</strong></td>
                <td>
                    <div>
                        <strong>${reserva.cliente_nombre}</strong><br>
                        <small>${reserva.cliente_telefono}</small>
                    </div>
                </td>
                <td>${reserva.servicio_nombre}</td>
                <td>
                    <span class="status-badge status-${reserva.estado}">
                        ${this.getStatusText(reserva.estado)}
                    </span>
                </td>
                <td><strong>$${parseFloat(reserva.precio_total).toLocaleString()}</strong></td>
                <td>
                    <button class="btn btn-primary" onclick="adminPanel.viewReserva(${reserva.id})" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'confirmada')" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn btn-danger" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'cancelada')" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
    }
    
    async loadReservas() {
        try {
            const date = document.getElementById('reservasFilterDate').value;
            const estado = document.getElementById('reservasFilterEstado').value;
            
            let url = '/api/admin/reservas?';
            if (date) url += `fecha=${date}&`;
            if (estado) url += `estado=${estado}&`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error('Error loading reservations');
            
            const reservas = await response.json();
            this.renderReservasTable(reservas);
            
        } catch (error) {
            console.error('Error loading reservas:', error);
            this.showError('Error cargando las reservas');
        }
    }
    
    renderReservasTable(reservas) {
        const container = document.getElementById('reservasTable');
        
        if (reservas.length === 0) {
            container.innerHTML = '<p style="padding: 2rem; text-align: center; color: #999;">No se encontraron reservas.</p>';
            return;
        }
        
        const table = `
            <table>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Fecha/Hora</th>
                        <th>Cliente</th>
                        <th>Servicio</th>
                        <th>Estado</th>
                        <th>Total</th>
                        <th>Pago</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservas.map(reserva => this.renderFullReservaRow(reserva)).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }
    
    renderFullReservaRow(reserva) {
        const fecha = new Date(reserva.fecha_hora);
        const fechaStr = fecha.toLocaleDateString('es-ES');
        const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        return `
            <tr>
                <td><strong>#${reserva.id}</strong></td>
                <td>
                    <div>
                        <strong>${fechaStr}</strong><br>
                        <small>${horaStr}</small>
                    </div>
                </td>
                <td>
                    <div>
                        <strong>${reserva.cliente_nombre}</strong><br>
                        <small>${reserva.cliente_email}</small><br>
                        <small>${reserva.cliente_telefono}</small>
                    </div>
                </td>
                <td>${reserva.servicio_nombre}</td>
                <td>
                    <span class="status-badge status-${reserva.estado}">
                        ${this.getStatusText(reserva.estado)}
                    </span>
                </td>
                <td><strong>$${parseFloat(reserva.precio_total).toLocaleString()}</strong></td>
                <td>
                    <small>${reserva.metodo_pago}</small><br>
                    <small>Seña: $${parseFloat(reserva.seña_pagada).toLocaleString()}</small>
                </td>
                <td>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="adminPanel.viewReserva(${reserva.id})" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${reserva.estado === 'pendiente' ? `
                            <button class="btn btn-success" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'confirmada')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        ${reserva.estado === 'confirmada' ? `
                            <button class="btn btn-warning" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'completada')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                                <i class="fas fa-flag-checkered"></i>
                            </button>
                        ` : ''}
                        <button class="btn btn-danger" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'cancelada')" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    async loadHorarios() {
        try {
            const response = await fetch('/api/horarios');
            if (!response.ok) throw new Error('Error loading horarios');
            
            const horarios = await response.json();
            this.renderHorariosConfig(horarios);
            
        } catch (error) {
            console.error('Error loading horarios:', error);
            this.showError('Error cargando los horarios');
        }
    }
    
    renderHorariosConfig(horarios) {
        const container = document.getElementById('horariosConfig');
        const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        
        let html = '<div style="padding: 2rem;">';
        
        for (let i = 0; i < 7; i++) {
            const horario = horarios.find(h => h.dia_semana === i) || {
                dia_semana: i,
                hora_inicio: '09:00',
                hora_fin: '18:00',
                activo: i !== 0 // Domingo cerrado por defecto
            };
            
            html += `
                <div style="display: grid; grid-template-columns: 150px 1fr 1fr 100px; gap: 1rem; align-items: center; margin-bottom: 1rem; padding: 1rem; border: 1px solid #ddd; border-radius: 8px;">
                    <strong>${dias[i]}</strong>
                    <div>
                        <label>Inicio:</label>
                        <input type="time" id="inicio_${i}" value="${horario.hora_inicio}" ${!horario.activo ? 'disabled' : ''}>
                    </div>
                    <div>
                        <label>Fin:</label>
                        <input type="time" id="fin_${i}" value="${horario.hora_fin}" ${!horario.activo ? 'disabled' : ''}>
                    </div>
                    <label>
                        <input type="checkbox" id="activo_${i}" ${horario.activo ? 'checked' : ''} onchange="adminPanel.toggleDay(${i})">
                        Activo
                    </label>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    toggleDay(dia) {
        const activo = document.getElementById(`activo_${dia}`).checked;
        document.getElementById(`inicio_${dia}`).disabled = !activo;
        document.getElementById(`fin_${dia}`).disabled = !activo;
    }
    
    async saveHorarios() {
        try {
            const horarios = [];
            
            for (let i = 0; i < 7; i++) {
                const activo = document.getElementById(`activo_${i}`).checked;
                const inicio = document.getElementById(`inicio_${i}`).value;
                const fin = document.getElementById(`fin_${i}`).value;
                
                if (activo) {
                    horarios.push({
                        dia_semana: i,
                        hora_inicio: inicio,
                        hora_fin: fin,
                        activo: true
                    });
                }
            }
            
            const response = await fetch('/api/admin/horarios', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ horarios })
            });
            
            if (!response.ok) throw new Error('Error saving horarios');
            
            this.showSuccess('Horarios guardados exitosamente');
            
        } catch (error) {
            console.error('Error saving horarios:', error);
            this.showError('Error guardando los horarios');
        }
    }
    
    async loadServicios() {
        try {
            const response = await fetch('/api/servicios');
            if (!response.ok) throw new Error('Error loading servicios');
            
            const servicios = await response.json();
            this.renderServiciosTable(servicios);
            
        } catch (error) {
            console.error('Error loading servicios:', error);
            this.showError('Error cargando los servicios');
        }
    }
    
    renderServiciosTable(servicios) {
        const container = document.getElementById('serviciosTable');
        
        const table = `
            <div class="table-header">
                <h2>Lista de Servicios</h2>
                <button class="btn btn-primary" onclick="adminPanel.openServiceModal()">
                    <i class="fas fa-plus"></i>
                    Nuevo Servicio
                </button>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th>Precio</th>
                        <th>Duración</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${servicios.map(servicio => `
                        <tr>
                            <td><strong>${servicio.nombre}</strong></td>
                            <td>${servicio.descripcion}</td>
                            <td><strong>$${parseFloat(servicio.precio).toLocaleString()}</strong></td>
                            <td>${servicio.duracion} min</td>
                            <td>
                                <span class="status-badge ${servicio.activo ? 'status-confirmada' : 'status-cancelada'}">
                                    ${servicio.activo ? 'Activo' : 'Inactivo'}
                                </span>
                            </td>
                            <td>
                                <button class="btn btn-primary" onclick="adminPanel.editService(${servicio.id})" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-danger" onclick="adminPanel.deleteService(${servicio.id})" style="padding: 0.3rem 0.8rem; font-size: 0.8rem;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        container.innerHTML = table;
    }
    
    async viewReserva(id) {
        try {
            const response = await fetch(`/api/admin/reservas`);
            if (!response.ok) throw new Error('Error loading reservation');
            
            const reservas = await response.json();
            const reserva = reservas.find(r => r.id === id);
            
            if (!reserva) {
                this.showError('Reserva no encontrada');
                return;
            }
            
            this.renderReservaDetail(reserva);
            this.openModal('reservaModal');
            
        } catch (error) {
            console.error('Error loading reservation detail:', error);
            this.showError('Error cargando el detalle de la reserva');
        }
    }
    
    renderReservaDetail(reserva) {
        const fecha = new Date(reserva.fecha_hora);
        const fechaStr = fecha.toLocaleDateString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const horaStr = fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        
        const html = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                <div>
                    <h4>Información del Cliente</h4>
                    <p><strong>Nombre:</strong> ${reserva.cliente_nombre}</p>
                    <p><strong>Email:</strong> ${reserva.cliente_email}</p>
                    <p><strong>Teléfono:</strong> ${reserva.cliente_telefono}</p>
                    ${reserva.cliente_edad ? `<p><strong>Edad:</strong> ${reserva.cliente_edad} años</p>` : ''}
                    ${reserva.observaciones ? `
                        <h4>Observaciones</h4>
                        <p>${reserva.observaciones}</p>
                    ` : ''}
                </div>
                
                <div>
                    <h4>Detalles de la Reserva</h4>
                    <p><strong>Servicio:</strong> ${reserva.servicio_nombre}</p>
                    <p><strong>Fecha:</strong> ${fechaStr}</p>
                    <p><strong>Hora:</strong> ${horaStr}</p>
                    <p><strong>Duración:</strong> ${reserva.duracion} minutos</p>
                    <p><strong>Estado:</strong> 
                        <span class="status-badge status-${reserva.estado}">
                            ${this.getStatusText(reserva.estado)}
                        </span>
                    </p>
                    
                    <h4>Información de Pago</h4>
                    <p><strong>Total:</strong> $${parseFloat(reserva.precio_total).toLocaleString()}</p>
                    <p><strong>Seña pagada:</strong> $${parseFloat(reserva.seña_pagada).toLocaleString()}</p>
                    <p><strong>Método de pago:</strong> ${reserva.metodo_pago}</p>
                    <p><strong>Saldo pendiente:</strong> $${(parseFloat(reserva.precio_total) - parseFloat(reserva.seña_pagada)).toLocaleString()}</p>
                </div>
            </div>
            
            <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #ddd;">
                <h4>Acciones</h4>
                <div style="display: flex; gap: 1rem; margin-top: 1rem;">
                    <button class="btn btn-success" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'confirmada')">
                        <i class="fas fa-check"></i> Confirmar
                    </button>
                    <button class="btn btn-warning" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'completada')">
                        <i class="fas fa-flag-checkered"></i> Completar
                    </button>
                    <button class="btn btn-danger" onclick="adminPanel.updateReservaEstado(${reserva.id}, 'cancelada')">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        `;
        
        document.getElementById('reservaDetail').innerHTML = html;
    }
    
    async updateReservaEstado(id, estado) {
        if (!confirm(`¿Estás seguro de cambiar el estado a "${this.getStatusText(estado)}"?`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/admin/reservas/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ estado })
            });
            
            if (!response.ok) throw new Error('Error updating reservation');
            
            this.showSuccess('Estado actualizado exitosamente');
            this.closeModal('reservaModal');
            
            // Reload current section
            if (this.currentSection === 'dashboard') {
                this.loadDashboard();
            } else if (this.currentSection === 'reservas') {
                this.loadReservas();
            }
            
        } catch (error) {
            console.error('Error updating reservation:', error);
            this.showError('Error actualizando el estado');
        }
    }
    
    openServiceModal(serviceId = null) {
        if (serviceId) {
            // Edit mode
            document.getElementById('serviceModalTitle').textContent = 'Editar Servicio';
            // Load service data...
        } else {
            // Create mode
            document.getElementById('serviceModalTitle').textContent = 'Nuevo Servicio';
            document.getElementById('serviceForm').reset();
            document.getElementById('serviceId').value = '';
        }
        
        this.openModal('serviceModal');
    }
    
    async saveService() {
        try {
            const formData = new FormData(document.getElementById('serviceForm'));
            const serviceData = {
                nombre: formData.get('nombre'),
                descripcion: formData.get('descripcion'),
                precio: parseFloat(formData.get('precio')),
                duracion: parseInt(formData.get('duracion')),
                activo: formData.get('activo') === 'on'
            };
            
            const id = formData.get('id');
            const method = id ? 'PUT' : 'POST';
            const url = id ? `/api/servicios/${id}` : '/api/servicios';
            
            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(serviceData)
            });
            
            if (!response.ok) throw new Error('Error saving service');
            
            this.showSuccess('Servicio guardado exitosamente');
            this.closeModal('serviceModal');
            this.loadServicios();
            
        } catch (error) {
            console.error('Error saving service:', error);
            this.showError('Error guardando el servicio');
        }
    }
    
    getStatusText(status) {
        const statusMap = {
            'pendiente': 'Pendiente',
            'confirmada': 'Confirmada',
            'completada': 'Completada',
            'cancelada': 'Cancelada'
        };
        return statusMap[status] || status;
    }
    
    openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
    }
    
    closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
    }
    
    showSuccess(message) {
        this.showNotification(message, 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type = 'info') {
        // Simple notification implementation
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 5px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#F44336' : '#2196F3'};
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }
    
    async exportReservas() {
        // Implementation for exporting reservations
        this.showSuccess('Función de exportación en desarrollo');
    }
}

// Initialize admin panel
let adminPanel;

document.addEventListener('DOMContentLoaded', () => {
    adminPanel = new AdminPanel();
});

// Global functions for onclick events
window.adminPanel = {
    viewReserva: (id) => adminPanel.viewReserva(id),
    updateReservaEstado: (id, estado) => adminPanel.updateReservaEstado(id, estado),
    openServiceModal: (id) => adminPanel.openServiceModal(id),
    editService: (id) => adminPanel.openServiceModal(id),
    deleteService: (id) => adminPanel.deleteService(id),
    toggleDay: (dia) => adminPanel.toggleDay(dia),
    saveHorarios: () => adminPanel.saveHorarios(),
    exportReservas: () => adminPanel.exportReservas(),
    closeModal: (modalId) => adminPanel.closeModal(modalId),
    loadDashboard: () => adminPanel.loadDashboard(),
    loadReservas: () => adminPanel.loadReservas()
};
