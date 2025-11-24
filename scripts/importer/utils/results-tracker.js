/**
 * Track and display conversion results
 */
class ResultsTracker {
  constructor() {
    this.results = {};
  }

  /**
   * Add a result for a content type
   * @param {string} type - Content type
   * @param {Object} result - Result object with successful, failed, total
   */
  add(type, result) {
    this.results[type] = result;
  }

  /**
   * Display results for a specific type
   * @param {string} type - Content type
   */
  display(type) {
    const result = this.results[type];
    if (!result || result.total === 0) return;

    const status = result.failed > 0 ? '⚠️' : '✅';
    console.log(`${status} ${type}: ${result.successful}/${result.total} converted`);
    if (result.failed > 0) {
      console.log(`   Failed: ${result.failed} files`);
    }
  }

  /**
   * Get total number of successful conversions
   * @returns {number} Total successful
   */
  get totalConverted() {
    return Object.values(this.results).reduce((sum, r) => sum + r.successful, 0);
  }

  /**
   * Get total number of failed conversions
   * @returns {number} Total failed
   */
  get totalFailed() {
    return Object.values(this.results).reduce((sum, r) => sum + r.failed, 0);
  }

  /**
   * Display summary of all results
   */
  displaySummary() {
    console.log('='.repeat(50));
    console.log('Conversion Summary:');
    console.log('='.repeat(50));

    Object.keys(this.results).forEach(type => this.display(type));

    console.log('='.repeat(50));
    console.log(`Total files converted: ${this.totalConverted}`);
    if (this.totalFailed > 0) {
      console.log(`Total files failed: ${this.totalFailed}`);
    }
  }
}

module.exports = ResultsTracker;
