var DuplicateChecker = {
  async check(name, painPoint) {
    if (!name || name.trim().length < 3) return;
    try {
      const result = await Api.duplicateCheck(name, painPoint);
      if (result.duplicate_flag) {
        Toast.show(`Trùng lặp cao (${(result.similarity_score*100).toFixed(1)}%) với "${result.match_use_case_name}". Vui lòng kiểm tra lại.`, 'warning');
      }
    } catch (e) {
      // ignore duplicate check errors silently
    }
  }
};

// Attach listener later in app.js
