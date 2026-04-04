"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { GeneratedAvatar } from "@/components/generated-avatar";
import { ChevronDown, LogOutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUser, useClerk } from "@clerk/nextjs";

const DashboardUserButton = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  const handleLogout = async () => {
    await signOut();
    router.push("/sign-in");
  };

  if (!isLoaded || !user) {
    return null;
  }

  const userName = user.fullName ?? user.username ?? "User";
  const userEmail = user.primaryEmailAddress?.emailAddress ?? "";
  const userImage = user.imageUrl;

  if (isMobile) {
    return (
      <Drawer>
        <DrawerTrigger
          asChild
          className="rounded-lg border border-primary p-3 w-full flex items-center
    justify-between bg-ai-secondary/20 hover:bg-ai-secondary/60 overflow-hidden gap-x-2"
        >
          <div>
            {userImage ? (
              <Avatar>
                <AvatarImage src={userImage} />
              </Avatar>
            ) : (
              <GeneratedAvatar
                seed={userName}
                variant="initials"
                className="size-9 mr-3"
              />
            )}
            <div className="flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0">
              <p className="text-sm truncate w-full font-semibold">{userName}</p>
              <p className="text-xs truncate w-full text-accent">{userEmail}</p>
            </div>
            <ChevronDown className="size-4 shrink-0" />
          </div>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{userName}</DrawerTitle>
            <DrawerDescription>{userEmail}</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="outline" onClick={handleLogout}>
              <LogOutIcon className="size-4 text-black" />
              Logout
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-lg border border-primary p-3 w-full flex items-center
    justify-between bg-ai-secondary/20 hover:bg-ai-secondary/60 overflow-hidden gap-x-2"
      >
        {userImage ? (
          <Avatar>
            <AvatarImage src={userImage} />
          </Avatar>
        ) : (
          <GeneratedAvatar
            seed={userName}
            variant="initials"
            className="size-9 mr-3"
          />
        )}
        <div className="flex flex-col gap-0.5 text-left overflow-hidden flex-1 min-w-0">
          <p className="text-sm truncate w-full font-semibold">{userName}</p>
          <p className="text-xs truncate w-full text-accent">{userEmail}</p>
        </div>
        <ChevronDown className="size-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="right" className="w-72 ml-2">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="font-medium truncate">{userName}</span>
            <span className="text-sm text-muted-foreground truncate">
              {userEmail}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer flex items-center justify-between"
          onClick={handleLogout}
        >
          Logout
          <LogOutIcon className="size-4" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default DashboardUserButton;
