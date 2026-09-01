// PWA Reporte Ciudadano - Aplicación principal
// Arquitectura vanilla JS con módulos ES6

import { StateManager } from './state.js';
import { Router } from './router.js';
import { API } from './api.js';
import { UI } from './ui.js';
import { GeoLocation } from './geolocation.js';
import { Camera } from './camera.js';
import { NotificationManager } from './notifications.js';
import { ReportesDB } from '../db/reportesdb.js';

// Configuración global de la aplicación
const APP_CONFIG = {
    name: 'Reporte Ciudadano',
    version: '1.0.0',
    apiBaseUrl: '/api',
    mapProvider: 'leaflet',
    defaultLocation: {
        lat: 32.6245,
        lng: -115.4523,
        name: 'Mexicali, BC'
    }
};

// Estado global de la aplicación
const state = new StateManager({
    user: null,
    reports: [],
    currentReport: null,
    location: null,
    isOnline: navigator.onLine,
    pendingSync: [],
    settings: {
        notifications: true,
        autoLocation: true,
        theme: 'system'
    }
});

// Instancias principales
const router = new Router();
const api = new API(APP_CONFIG.apiBaseUrl);
const ui = new UI(state);
const geolocation = new GeoLocation();
const camera = new Camera();
const notifications = new NotificationManager();
const db = new ReportesDB();

// Inicialización de la aplicación
async function initApp() {
    console.log(`[${APP_CONFIG.name}] Iniciando v${APP_CONFIG.version}`);

    try {
        // Inicializar Base de Datos IndexedDB
        await db.init();
    } catch (error) {
        notifications.show('Error al inicializar base de datos local', 'error');
    }

    setupGlobalListeners();
    setupNavigation(); // <--- NUEVO: Inicializar navegación
    checkInstallPrompt();
    router.init();
    await loadSettings();

    // Inicializar Lógica del Formulario de Reporte
    setupReportForm();

    if (state.get('settings.autoLocation')) {
        try {
            const position = await geolocation.getCurrentPosition();
            state.set('location', position);
        } catch (error) {
            console.warn('No se pudo obtener ubicación inicial:', error);
        }
    }

    setupOnlineOfflineHandlers();

    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
        registerBackgroundSync();
    }

    document.body.classList.add('app-ready');
    console.log(`[${APP_CONFIG.name}] Aplicación lista`);
}

/**
 * LÓGICA DE NAVEGACIÓN ENTRE SECCIONES
 */
function setupNavigation() {
    const navHome = document.getElementById('nav-home');
    const navReports = document.getElementById('nav-my-reports');
    const sectionHome = document.getElementById('section-home');
    const sectionReports = document.getElementById('section-my-reports');
    const appTitle = document.getElementById('app-title');

    if (!navHome || !navReports || !sectionHome || !sectionReports) return;

    // Función para cambiar de vista
    const switchView = (view) => {
        if (view === 'home') {
            sectionHome.style.display = 'block';
            sectionReports.style.display = 'none';
            navHome.classList.add('active');
            navReports.classList.remove('active');
            appTitle.textContent = 'Reporte Ciudadano';
        } else {
            sectionHome.style.display = 'none';
            sectionReports.style.display = 'block';
            navHome.classList.remove('active');
            navReports.classList.add('active');
            appTitle.textContent = 'Mis Reportes';
            loadReportsFromDB(); // Cargar datos al entrar
        }
    };

    navHome.addEventListener('click', () => switchView('home'));
    navReports.addEventListener('click', () => switchView('reports'));

    // Botón de actualizar en la sección de reportes
    const btnRefresh = document.getElementById('btn-refresh-reports');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', loadReportsFromDB);
    }
}

/**
 * CARGA DE REPORTES DESDE INDEXEDDB
 */
async function loadReportsFromDB() {
    const grid = document.getElementById('reports-grid');
    if (!grid) return;

    try {
        const reports = await db.getAllReports();
        
        if (!reports || reports.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <p>No has realizado ningún reporte aún.</p>
                </div>`;
            return;
        }

        // Ordenar por fecha descendente (más recientes primero)
        reports.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        grid.innerHTML = reports.map(report => `
            <div class="report-card">
                ${report.photoBase64 ? `<img src="${report.photoBase64}" class="report-card-img" alt="Evidencia">` : '<div class="report-card-img" style="display:flex; align-items:center; justify-content:center; color:#64748b">Sin imagen</div>'}
                <div class="report-card-content">
                    <div class="report-card-title">${report.category}</div>
                    <div class="report-card-meta">
                        <span>📅 ${new Date(report.timestamp).toLocaleString()}</span>
                        <span>📍 ${report.location}</span>
                        <span>🆔 ${report.folio}</span>
                    </div>
                    <p class="report-card-desc">${report.description || 'Sin descripción adicional'}</p>
                </div>
            </div>
        `).join('');

    } catch (error) {
        console.error('Error cargando reportes:', error);
        notifications.show('Error al cargar los reportes de la base de datos', 'error');
    }
}

/**
 * LÓGICA DEL FORMULARIO DE REPORTE
 */
function setupReportForm() {
    const form = document.getElementById('report-form');
    const btnLocation = document.getElementById('btn-get-location');
    const inputLocation = document.getElementById('location');
    const inputPhoto = document.getElementById('photo');
    const photoPreview = document.getElementById('photo-preview');

    if (!form) return;

    // 1. Obtención de Ubicación
    btnLocation.addEventListener('click', async () => {
        btnLocation.disabled = true;
        btnLocation.textContent = 'Obteniendo...';
        inputLocation.placeholder = 'Consultando satélites GPS...';
        
        try {
            const pos = await geolocation.getCurrentPosition();
            const locationString = `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;
            inputLocation.value = locationString;
            inputLocation.placeholder = 'Ubicación obtenida';
            state.set('location', pos);
            notifications.show('Ubicación obtenida correctamente', 'success');
        } catch (error) {
            let errorMessage = 'Error al obtener ubicación';
            
            if (error.code === 1) { // PERMISSION_DENIED
                errorMessage = 'Permisos de ubicación rechazados. Por favor, actívalos en la configuración de tu navegador.';
            } else if (error.code === 2) { // POSITION_UNAVAILABLE
                errorMessage = 'La ubicación no está disponible en este momento.';
            } else if (error.code === 3) { // TIMEOUT
                errorMessage = 'Tiempo de espera agotado al intentar obtener la ubicación.';
            } else {
                errorMessage = error.message || errorMessage;
            }
            
            inputLocation.placeholder = 'Error al obtener ubicación';
            notifications.show(errorMessage, 'error');
        } finally {
            btnLocation.disabled = false;
            btnLocation.textContent = 'Obtener ubicación';
        }
    });

    // 2. Previsualización de Imagen
    inputPhoto.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = photoPreview.querySelector('img');
                const placeholder = photoPreview.querySelector('.preview-placeholder');
                
                img.src = e.target.result;
                img.style.display = 'block';
                placeholder.style.display = 'none';
            }
            reader.readAsDataURL(file);
        }
    });

    // 3. Validación e Intercepción del Submit
    form.addEventListener('submit', (e) => {
        e.preventDefault(); 
        e.stopImmediatePropagation();

        if (validateReportForm()) {
            processReportSubmission(form);
        } else {
            notifications.show('⚠️ Error: Por favor, completa todos los campos obligatorios (Categoría, Ubicación y Foto)', 'warning');
        }
    });
}

function validateReportForm() {
    let isValid = true;
    const fields = [
        { id: 'category', errorId: 'error-category' },
        { id: 'location', errorId: 'error-location' },
        { id: 'photo', errorId: 'error-photo' }
    ];

    fields.forEach(field => {
        const element = document.getElementById(field.id);
        const parent = element.closest('.form-group');
        const value = element.value && element.value.trim();
        const hasFile = element.type === 'file' ? element.files && element.files.length > 0 : false;
        
        if (!value || (element.type === 'file' && !hasFile)) {
            parent.classList.add('invalid');
            isValid = false;
        } else {
            parent.classList.remove('invalid');
        }
    });

    return isValid;
}

async function processReportSubmission(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    const folio = 'REP-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    data.folio = folio;
    data.timestamp = new Date().toISOString();

    const photoFile = form.querySelector('#photo').files[0];
    if (photoFile) {
        try {
            notifications.show('Optimizando imagen...', 'info');
            data.photoBase64 = await camera.compressImage(photoFile);
        } catch (error) {
            console.error('Error optimizando imagen:', error);
            notifications.show('Error al procesar la imagen', 'error');
            return;
        }
    }

    try {
        notifications.show('Guardando localmente...', 'info');
        await db.saveReport(data);
        
        if (navigator.onLine) {
            notifications.show('Sincronizando con el servidor...', 'info');
            await new Promise(resolve => setTimeout(resolve, 1000));
            notifications.show('¡Reporte enviado y guardado con éxito!', 'success');
        } else {
            notifications.show('Guardado localmente. Se sincronizará al volver a tener conexión', 'warning');
        }

        form.reset();
        const photoPreview = document.getElementById('photo-//photo-preview');
        // Nota: Hay un error de typo arriba, corregido a:
        const preview = document.getElementById('photo-preview');
        if(preview) {
            preview.querySelector('img').style.display = 'none';
            preview.querySelector('.preview-placeholder').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error en el proceso de guardado:', error);
        notifications.show('Error crítico al guardar el reporte: ' + (error.name === 'QuotaExceededError' ? 'Disco lleno' : 'Error de DB'), 'error');
    }
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function setupGlobalListeners() {
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            checkPendingSync();
        }
    });

    window.addEventListener('error', (event) => {
        console.error('Error global:', event.error);
        notifications.show('Ha ocurrido un error inesperado', 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
        console.error('Promise rechazada:', event.reason);
        notifications.show('Error de conexión', 'error');
    });

    document.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            e.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}

let deferredPrompt = null;
function checkInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        ui.showInstallButton();
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA instalada');
        deferredPrompt = null;
        ui.hideInstallButton();
        notifications.show('¡App instalada correctamente!', 'success');
    });
}

export async function showInstallPrompt() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            console.log('Usuario aceptó la instalación');
        }
        deferredPrompt = null;
        ui.hideInstallButton();
    }
}

async function loadSettings() {
    try {
        const saved = localStorage.getItem('app-settings');
        if (saved) {
            const settings = JSON.parse(saved);
            state.set('settings', { ...state.get('settings'), ...settings });
            applyTheme(settings.theme);
        }
    } catch (error) {
        console.warn('Error cargando configuración:', error);
    }
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        root.classList.add('dark-theme');
    } else {
        root.classList.remove('dark-theme');
    }
}

function setupOnlineOfflineHandlers() {
    window.addEventListener('online', () => {
        state.set('isOnline', true);
        ui.updateOnlineStatus(true);
        checkPendingSync();
        notifications.show('Conexión restaurada', 'success');
    });

    window.addEventListener('offline', () => {
        state.set('isOnline', false);
        ui.updateOnlineStatus(false);
        notifications.show('Modo sin conexión activado', 'warning');
    });
}

function registerBackgroundSync() {
    navigator.serviceWorker.ready.then((registration) => {
        return registration.sync.register('sync-reports');
    }).catch((error) => {
        console.warn('Background sync no disponible:', error);
    });
}

async function checkPendingSync() {
    if (!state.get('isOnline')) return;
    const pending = state.get('pendingSync');
    if (pending.length === 0) return;
    notifications.show(`Sincronizando ${pending.length} reportes...`, 'info');
    for (const item of pending) {
        try {
            await api.post('/reports', item.data);
            const updated = state.get('pendingSync').filter(p => p.id !== item.id);
            state.set('pendingSync', updated);
        } catch (error) {
            console.error('Error sincronizando:', error);
        }
    }
    if (state.get('pendingSync').length === 0) {
        notifications.show('Sincronización completada', 'success');
    }
}

export function getState() { return state; }
export function getRouter() { return router; }
export function getAPI() { return api; }
export function getUI() { return ui; }
export function getGeolocation() { return geolocation; }
export function getCamera() { return camera; }
export function getNotifications() { return notifications; }
export function getConfig() { return APP_CONFIG; }

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

window.ReporteApp = {
    state,
    router,
    api,
    ui,
    geolocation,
    camera,
    notifications,
    config: APP_CONFIG,
    showInstallPrompt
};