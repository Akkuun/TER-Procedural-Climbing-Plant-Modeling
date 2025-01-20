import Stats from "three/addons/libs/stats.module.js";

class Monitor {
    constructor() {
        this.stats = new Stats();
        this.stats.showPanel(0);
        document.body.appendChild(this.stats.dom);
    }

    begin() {
        this.stats.begin();
    }

    end() {
        this.stats.end();
    }
}

export default Monitor;