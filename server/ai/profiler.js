export const profiler = {
  data: {},

  start(name) {
    if (!this.data[name]) {
      this.data[name] = { total: 0, count: 0 };
    }
    return performance.now();
  },

  end(name, startTime) {
    const elapsed = performance.now() - startTime;
    this.data[name].total += elapsed;
    this.data[name].count += 1;
  },

  report() {
    console.log("\n===== PROFILER REPORT =====");

    for (const [name, stat] of Object.entries(this.data)) {
      console.log(
        name,
        "avg:",
        (stat.total / stat.count).toFixed(3),
        "ms",
        "| total:",
        stat.total.toFixed(1),
        "ms",
        "| calls:",
        stat.count
      );
    }
  }
};