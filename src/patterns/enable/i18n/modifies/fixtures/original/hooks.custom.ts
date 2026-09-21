export const reroute = ({ url }) => {
  if (url.pathname === "/old") return "/new";
  return url.pathname;
};
