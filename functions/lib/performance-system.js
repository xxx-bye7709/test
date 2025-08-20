class PerformanceSystem {
  constructor() {
    this.metrics = {};
  }

  startTimer(name) {
    this.metrics[name] = { 
      start: Date.now() 
    };
  }

  endTimer(name) {
    if (this.metrics[name]) {
      this.metrics[name].end = Date.now();
      this.metrics[name].duration = this.metrics[name].end - this.metrics[name].start;
      return this.metrics[name].duration;
    }
    return 0;
  }

  getMetrics() {
    return this.metrics;
  }

  reset() {
    this.metrics = {};
  }
}

module.exports = PerformanceSystem;
