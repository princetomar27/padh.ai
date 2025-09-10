import { botttsNeutral, initials } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

interface AvatarProps {
  seed: string;
  variant: "bottsNeutral" | "initials";
}

export const generateAvatarURI = ({ seed, variant }: AvatarProps) => {
  let avatar;

  if (variant === "bottsNeutral") {
    avatar = createAvatar(botttsNeutral, { seed });
  } else {
    avatar = createAvatar(initials, { seed, fontWeight: 500, fontSize: 42 });
  }

  return avatar.toDataUri();
};
