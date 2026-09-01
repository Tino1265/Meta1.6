/**
 * Gestión de Base de Datos Local utilizando IndexedDB
 * Provee persistencia offline para los reportes ciudadanos.
 */
class ReportesDB {
    constructor() {
        this.dbName = 'ReportesDB';
        this.dbVersion = 1;
        this.storeName = 'reportes';
        this.db = null;
    }

    /**
     * Inicializa la base de datos y crea el Object Store si no existe.
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    // Definimos 'folio' como clave primaria
                    db.createObjectStore(this.storeName, { keyPath: 'folio' });
                    console.log(`[DB] Object Store '${this.storeName}' creado con clave primaria 'folio'.`);
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                console.log('[DB] ReportesDB inicializada exitosamente.');
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error('[DB] Error al abrir IndexedDB:', event.target.error);
                reject(event.target.error);
            };
        });
    }

    /**
     * Guarda un reporte en la base de datos local.
     * @param {Object} report - Objeto del reporte a guardar.
     * @returns {Promise<Object>} Confirmación del guardado.
     */
    async saveReport(report) {
        if (!this.db) {
            await this.init();
        }

        return new Promise((resolve, reject) => {
            try {
                // Iniciamos transacción de escritura (readwrite)
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                
                // Realizamos la operación de guardado (put añade o actualiza)
                const request = store.put(report);

                request.onsuccess = () => {
                    resolve({ success: true, folio: report.folio });
                };

                request.onerror = (event) => {
                    console.error('[DB] Error en la transacción de escritura:', event.target.error);
                    reject(event.target.error);
                };

                // Manejo de errores de la transacción (ej. cuota de disco llena)
                transaction.onerror = (event) => {
                    console.error('[DB] Error de transacción general:', event.target.error);
                    reject(event.target.error);
                };

            } catch (error) {
                console.error('[DB] Excepción al intentar guardar reporte:', error);
                reject(error);
            }
        });
    }

    /**
     * Recupera todos los reportes almacenados localmente.
     * @returns {Promise<Array>}
     */
    async getAllReports() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Elimina un reporte por su folio.
     * @param {string} folio 
     */
    async deleteReport(folio) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(folio);

            request.onsuccess = () => resolve(true);
            request.onerror = (event) => reject(event.target.error);
        });
    }
}

export { ReportesDB };