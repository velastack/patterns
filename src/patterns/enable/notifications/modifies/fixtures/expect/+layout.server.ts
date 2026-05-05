export const load = async ({ locals, depends }) => {
  const user = locals.pb.authStore.record!;
  const breadcrumbs = [{ title: "Home", url: "/dashboard" }];
  const notificationsList = await locals.pb
    .collection("notifications")
    .getList(1, 5, {
      filter: `user = "${locals.pb.authStore.record!.id}" && read = false`,
      sort: "-created",
    });
  const notifications = {
    count: notificationsList.totalItems,
    items: notificationsList.items,
  };
  depends("app:notifications");

  return {
    user,
    breadcrumbs,
    notifications,
  };
};
