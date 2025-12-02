// ========================================
// BELLA ESTÉTICA - JAVASCRIPT PRINCIPAL
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    // Inicializar todas las funcionalidades
    initNavigation();
    initPromoPopup();
    initNewsletterPopup();
    initTestimonials();
    initAnimations();
    initAnalytics();
    initWhatsAppTracking();
    
    console.log('🌸 Bella Estética - Sistema iniciado correctamente');
});

// ========================================
// NAVEGACIÓN
// ========================================

function initNavigation() {
    const navToggle = document.querySelector('.nav-toggle');
    const navMenu = document.querySelector('.nav-menu');
    const navLinks = document.querySelectorAll('.nav-menu a');

    // Toggle del menú móvil
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
            
            // Animación del hamburger
            const spans = navToggle.querySelectorAll('span');
            spans.forEach((span, index) => {
                if (navToggle.classList.contains('active')) {
                    if (index === 0) span.style.transform = 'rotate(45deg) translate(5px, 5px)';
                    if (index === 1) span.style.opacity = '0';
                    if (index === 2) span.style.transform = 'rotate(-45deg) translate(7px, -6px)';
                } else {
                    span.style.transform = 'none';
                    span.style.opacity = '1';
                }
            });
        });
    }

    // Cerrar menú al hacer click en links
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
            
            // Resetear hamburger
            const spans = navToggle.querySelectorAll('span');
            spans.forEach(span => {
                span.style.transform = 'none';
                span.style.opacity = '1';
            });
        });
    });

    // Smooth scroll para links internos
    navLinks.forEach(link => {
        if (link.getAttribute('href').startsWith('#')) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = link.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    const offsetTop = targetElement.offsetTop - 80; // Offset para el navbar fijo
                    window.scrollTo({
                        top: offsetTop,
                        behavior: 'smooth'
                    });
                }
            });
        }
    });

    // Cambiar color del navbar al hacer scroll
    window.addEventListener('scroll', () => {
        const navbar = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(255, 255, 255, 0.98)';
            navbar.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        } else {
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
    });
}

// ========================================
// PROMOCIÓN BANNER
// ========================================

function initPromoPopup() {
    const promoBanner = document.querySelector('.promo-banner');
    const promoClose = document.querySelector('.promo-close');

    if (promoClose) {
        promoClose.addEventListener('click', () => {
            promoBanner.style.display = 'none';
            
            // Guardar en localStorage para no mostrar otra vez
            localStorage.setItem('promoBannerClosed', 'true');
            
            // Analytics
            gtag('event', 'promo_banner_closed', {
                'event_category': 'engagement',
                'event_label': 'header_promo'
            });
        });
    }

    // Verificar si ya fue cerrado
    if (localStorage.getItem('promoBannerClosed') === 'true') {
        if (promoBanner) promoBanner.style.display = 'none';
    }
}

// ========================================
// NEWSLETTER POPUP
// ========================================

function initNewsletterPopup() {
    const popup = document.getElementById('newsletterPopup');
    const closeBtn = popup.querySelector('.popup-close');
    const form = document.getElementById('newsletterForm');

    // Mostrar popup después de 30 segundos o al scroll al 50%
    let popupShown = false;
    const showPopup = () => {
        if (!popupShown && !localStorage.getItem('newsletterSubscribed')) {
            popup.style.display = 'block';
            popupShown = true;
            
            // Analytics
            gtag('event', 'newsletter_popup_shown', {
                'event_category': 'engagement',
                'event_label': 'auto_trigger'
            });
        }
    };

    // Trigger por tiempo
    setTimeout(showPopup, 30000);

    // Trigger por scroll
    window.addEventListener('scroll', () => {
        const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrollPercent > 50) {
            showPopup();
        }
    });

    // Cerrar popup
    closeBtn.addEventListener('click', () => {
        popup.style.display = 'none';
        
        // Analytics
        gtag('event', 'newsletter_popup_closed', {
            'event_category': 'engagement',
            'event_label': 'close_button'
        });
    });

    // Cerrar al hacer click fuera
    popup.addEventListener('click', (e) => {
        if (e.target === popup) {
            popup.style.display = 'none';
        }
    });

    // Manejar envío del formulario
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = form.querySelector('input[type="email"]').value;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        
        // UI Loading
        submitBtn.textContent = 'Suscribiendo...';
        submitBtn.disabled = true;
        
        try {
            // Aquí iría la integración con tu servicio de email marketing
            // Por ahora simulamos la llamada
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Success
            submitBtn.textContent = '¡Suscrito! 🎉';
            submitBtn.style.background = '#4caf50';
            
            // Cerrar popup después de 2 segundos
            setTimeout(() => {
                popup.style.display = 'none';
                localStorage.setItem('newsletterSubscribed', 'true');
            }, 2000);
            
            // Analytics
            gtag('event', 'newsletter_signup', {
                'event_category': 'conversion',
                'event_label': 'popup_form',
                'value': 1
            });
            
            // Facebook Pixel
            fbq('track', 'Lead', {
                content_name: 'Newsletter Signup',
                content_category: 'Email Marketing'
            });
            
        } catch (error) {
            console.error('Error al suscribir:', error);
            submitBtn.textContent = 'Error. Intenta de nuevo';
            submitBtn.style.background = '#f44336';
            
            setTimeout(() => {
                submitBtn.textContent = originalText;
                submitBtn.style.background = '';
                submitBtn.disabled = false;
            }, 3000);
        }
    });
}

// ========================================
// TESTIMONIOS CAROUSEL
// ========================================

function initTestimonials() {
    const testimonialCards = document.querySelectorAll('.testimonio-card');
    let currentTestimonial = 0;

    if (testimonialCards.length === 0) return;

    const showTestimonial = (index) => {
        testimonialCards.forEach((card, i) => {
            card.classList.toggle('active', i === index);
        });
    };

    const nextTestimonial = () => {
        currentTestimonial = (currentTestimonial + 1) % testimonialCards.length;
        showTestimonial(currentTestimonial);
    };

    // Auto-rotate cada 5 segundos
    setInterval(nextTestimonial, 5000);

    // Controles manuales (si se implementan más adelante)
    testimonialCards.forEach((card, index) => {
        card.addEventListener('click', () => {
            currentTestimonial = index;
            showTestimonial(currentTestimonial);
        });
    });
}

// ========================================
// ANIMACIONES SCROLL
// ========================================

function initAnimations() {
    // Intersection Observer para animaciones
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('fade-in-up');
                
                // Animar contadores
                if (entry.target.classList.contains('stat-number')) {
                    animateCounter(entry.target);
                }
            }
        });
    }, observerOptions);

    // Observar elementos para animar
    const elementsToAnimate = document.querySelectorAll('.servicio-card, .testimonio-card, .feature, .stat');
    elementsToAnimate.forEach(el => observer.observe(el));

    // Observar contadores
    const counters = document.querySelectorAll('.stat-number');
    counters.forEach(counter => observer.observe(counter));
}

function animateCounter(element) {
    const target = parseInt(element.textContent.replace(/\D/g, ''));
    const duration = 2000;
    const increment = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        
        // Mantener el sufijo original (+ si existe)
        const suffix = element.textContent.includes('+') ? '+' : '';
        element.textContent = Math.floor(current) + suffix;
    }, 16);
}

// ========================================
// ANALYTICS Y TRACKING
// ========================================

function initAnalytics() {
    // Track clicks en servicios
    const serviceBtns = document.querySelectorAll('.servicio-card .btn');
    serviceBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const serviceName = btn.closest('.servicio-card').querySelector('h3').textContent;
            const servicePrice = btn.closest('.servicio-card').querySelector('.servicio-price').textContent;
            
            gtag('event', 'service_interest', {
                'event_category': 'engagement',
                'event_label': serviceName,
                'value': parseInt(servicePrice.replace(/\D/g, ''))
            });
        });
    });

    // Track scroll depth
    let maxScroll = 0;
    window.addEventListener('scroll', debounce(() => {
        const scrollPercent = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
        
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
            
            // Track milestones
            if (scrollPercent >= 25 && maxScroll < 25) {
                gtag('event', 'scroll_depth_25', {'event_category': 'engagement'});
            } else if (scrollPercent >= 50 && maxScroll < 50) {
                gtag('event', 'scroll_depth_50', {'event_category': 'engagement'});
            } else if (scrollPercent >= 75 && maxScroll < 75) {
                gtag('event', 'scroll_depth_75', {'event_category': 'engagement'});
            } else if (scrollPercent >= 100 && maxScroll < 100) {
                gtag('event', 'scroll_depth_100', {'event_category': 'engagement'});
            }
        }
    }, 250));

    // Track time on page
    let startTime = Date.now();
    let timeTracked = false;
    
    window.addEventListener('beforeunload', () => {
        if (!timeTracked) {
            const timeSpent = Math.round((Date.now() - startTime) / 1000);
            gtag('event', 'time_on_page', {
                'event_category': 'engagement',
                'value': timeSpent
            });
            timeTracked = true;
        }
    });

    // Track después de 30 segundos también
    setTimeout(() => {
        if (!timeTracked) {
            const timeSpent = Math.round((Date.now() - startTime) / 1000);
            gtag('event', 'engaged_session', {
                'event_category': 'engagement',
                'value': timeSpent
            });
        }
    }, 30000);
}

function initWhatsAppTracking() {
    // Track todos los clicks de WhatsApp
    const whatsappLinks = document.querySelectorAll('a[href*="wa.me"], a[href*="whatsapp"], .whatsapp-float a, .whatsapp-contact');
    
    whatsappLinks.forEach((link, index) => {
        link.addEventListener('click', () => {
            const location = link.classList.contains('whatsapp-float') ? 'float_button' : 
                            link.classList.contains('whatsapp-contact') ? 'footer' : 
                            link.closest('.hero') ? 'hero' : 'other';
            
            gtag('event', 'whatsapp_click', {
                'event_category': 'contact',
                'event_label': location
            });
            
            // Facebook Pixel
            fbq('track', 'Contact', {
                content_name: 'WhatsApp Contact',
                content_category: 'Communication'
            });
        });
    });
}

// ========================================
// UTILIDADES
// ========================================

// Debounce function para performance
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Detectar si es móvil
function isMobile() {
    return window.innerWidth <= 768;
}

// Formatear precio
function formatPrice(price) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0
    }).format(price);
}

// Formatear fecha
function formatDate(date) {
    return new Intl.DateTimeFormat('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    }).format(date);
}

// ========================================
// API HELPERS
// ========================================

// Helper para llamadas API
async function apiCall(endpoint, options = {}) {
    const baseURL = window.location.hostname === 'localhost' ? 
                   'http://localhost:3000/api' : 
                   '/api';
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const config = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(`${baseURL}${endpoint}`, config);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// ========================================
// EXPORT PARA BOOKING.JS
// ========================================

// Hacer funciones disponibles globalmente
window.BellaEstetica = {
    apiCall,
    formatPrice,
    formatDate,
    isMobile,
    debounce
};

// ========================================
// ERROR HANDLING GLOBAL
// ========================================

window.addEventListener('error', (e) => {
    console.error('JavaScript Error:', e.error);
    
    // Track errors en Analytics
    gtag('event', 'javascript_error', {
        'event_category': 'error',
        'event_label': e.error.message,
        'value': 1
    });
});

// ========================================
// PWA PREPARACIÓN (FUTURO)
// ========================================

// Service Worker registration (para futuro)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Comentado por ahora, implementar en futuro
        // navigator.serviceWorker.register('/sw.js')
        //     .then(registration => console.log('SW registered'))
        //     .catch(error => console.log('SW registration failed'));
    });
}

// ========================================
// PERFORMANCE MONITORING
// ========================================

// Medir y reportar métricas de performance
window.addEventListener('load', () => {
    // Core Web Vitals tracking
    if ('web-vital' in window) {
        // Se implementaría con biblioteca externa
    }
    
    // Métricas básicas
    setTimeout(() => {
        const loadTime = performance.timing.loadEventEnd - performance.timing.navigationStart;
        
        gtag('event', 'page_load_time', {
            'event_category': 'performance',
            'value': Math.round(loadTime)
        });
    }, 0);
});

console.log('🌸 Bella Estética - Sistema de tracking y UI iniciado');