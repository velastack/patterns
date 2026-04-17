/// <reference path="../types.d.ts" />

module.exports = {
  triggerJob: (jobUrl) => {
    $http.send({
      method: "POST",
      url: `${$app.settings().meta.appURL}${jobUrl}`,
      headers: {
        Authorization: `Bearer ${$os.getenv("INTERNAL_JOB_SECRET")}`,
      },
    });
  },
};
