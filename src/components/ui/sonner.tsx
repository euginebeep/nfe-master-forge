import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      expand={true}
      richColors
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl group-[.toaster]:px-6 group-[.toaster]:py-5 group-[.toaster]:text-base group-[.toaster]:min-w-[360px] group-[.toaster]:max-w-[500px]",
          title: "group-[.toast]:text-lg group-[.toast]:font-bold",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-sm",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success: "group-[.toaster]:!bg-green-500 group-[.toaster]:!text-white group-[.toaster]:!border-green-600",
          error: "group-[.toaster]:!bg-red-500 group-[.toaster]:!text-white group-[.toaster]:!border-red-600",
          warning: "group-[.toaster]:!bg-yellow-500 group-[.toaster]:!text-black group-[.toaster]:!border-yellow-600",
          info: "group-[.toaster]:!bg-blue-500 group-[.toaster]:!text-white group-[.toaster]:!border-blue-600",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
