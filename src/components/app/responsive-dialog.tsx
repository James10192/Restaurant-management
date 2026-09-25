import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { useIsMobile } from "~/hooks/use-mobile";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "~/components/ui/drawer";

/*
 * Le motif « Responsive Dialog » de la documentation shadcn/ui : un `Dialog` sur grand écran,
 * un `Drawer` (tiroir qui monte du bas) sur téléphone. Les deux branches sont les composants
 * officiels ; ce fichier ne fait que choisir.
 */

const MobileContext = createContext(false);

export function ResponsiveDialog({
  open,
  onOpenChange,
  children,
}: {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}) {
  const isMobile = useIsMobile();
  const Root = isMobile ? Drawer : Dialog;
  return (
    <MobileContext.Provider value={isMobile}>
      <Root {...(open !== undefined ? { open } : {})} {...(onOpenChange ? { onOpenChange } : {})}>
        {children}
      </Root>
    </MobileContext.Provider>
  );
}

export function ResponsiveDialogTrigger(props: ComponentProps<typeof DialogTrigger>) {
  return useContext(MobileContext) ? <DrawerTrigger {...props} /> : <DialogTrigger {...props} />;
}

export function ResponsiveDialogClose(props: ComponentProps<typeof DialogClose>) {
  return useContext(MobileContext) ? <DrawerClose {...props} /> : <DialogClose {...props} />;
}

export function ResponsiveDialogContent({ className, children, ...props }: ComponentProps<typeof DialogContent>) {
  if (useContext(MobileContext)) {
    return (
      <DrawerContent className={className}>
        <div className="max-h-[85dvh] overflow-y-auto px-4 pb-4">{children}</div>
      </DrawerContent>
    );
  }
  return (
    <DialogContent className={className} {...props}>
      {children}
    </DialogContent>
  );
}

export function ResponsiveDialogHeader(props: ComponentProps<"div">) {
  return useContext(MobileContext) ? <DrawerHeader className="px-0 text-left" {...props} /> : <DialogHeader {...props} />;
}

export function ResponsiveDialogFooter(props: ComponentProps<"div">) {
  return useContext(MobileContext) ? <DrawerFooter className="px-0" {...props} /> : <DialogFooter {...props} />;
}

export function ResponsiveDialogTitle(props: ComponentProps<typeof DialogTitle>) {
  return useContext(MobileContext) ? <DrawerTitle {...props} /> : <DialogTitle {...props} />;
}

export function ResponsiveDialogDescription(props: ComponentProps<typeof DialogDescription>) {
  return useContext(MobileContext) ? <DrawerDescription {...props} /> : <DialogDescription {...props} />;
}
