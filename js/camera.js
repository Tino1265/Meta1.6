class Camera {
    /**
     * Procesa y optimiza una imagen para reducir el espacio en IndexedDB.
     * @param {File} file - El archivo de imagen capturado.
     * @returns {Promise<string>} - La imagen comprimida en formato Base64 JPEG.
     */
    async compressImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);

            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;

                img.onload = () => {
                    // 1. Crear elemento Canvas
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    // 2. Calcular dimensiones máximas manteniendo relación de aspecto
                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 768;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;

                    // 3. Dibujar la imagen en el canvas con el nuevo tamaño
                    ctx.drawImage(img, 0, 0, width, height);

                    // 4. Convertir a JPEG con calidad del 70% (0.7)
                    const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(compressedDataUrl);
                };

                img.onerror = (err) => reject(new Error('Error al cargar la imagen para compresión'));
            };

            reader.onerror = (err) => reject(new Error('Error al leer el archivo de imagen'));
        });
    }

    async takePhoto() {
        console.log('Capturando foto...');
        return null; 
    }

    async openCamera() {
        console.log('Abriendo cámara...');
    }
}

export { Camera };