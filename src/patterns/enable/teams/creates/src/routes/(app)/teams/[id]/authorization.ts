type Role = "owner" | "admin" | "member";

interface User {
  id: string;
}

interface Member {
  id: string;
  role: Role;
}

export const getAuthorization = ({
  user,
  role,
  member,
}: {
  user: User;
  role: Role;
  member?: Member;
}) => {
  const isSelf = member ? user.id === member.id : false;
  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  if (isSelf) {
    return {
      canRemove: false,
      canChangeRole: false,
    };
  } else if (isOwner) {
    return {
      canRemove: true,
      canChangeRole: true,
    };
  } else if (isAdmin) {
    if (member && member.role === "member") {
      return {
        canRemove: true,
        canChangeRole: false,
      };
    }

    return {
      canRemove: false,
      canChangeRole: false,
    };
  }

  return {
    canRemove: false,
    canChangeRole: false,
  };
};
