class UI {
    constructor(state) {
        this.state = state;
        this.mainElement = document.querySelector('.app-main');
    }

    showInstallButton() {
        // Implementación vacía para el botón de instalación
    }

    hideInstallButton() {
        // Implementación vacía para el botón de instalación
    }

    updateOnlineStatus(isOnline) {
        console.log(`UI: Actualizando estado de conexión a ${isOnline ? 'Online' : 'Offline'}`);
    }

    render(html) {
        this.mainElement.innerHTML = html;
    }
}

export { UI };