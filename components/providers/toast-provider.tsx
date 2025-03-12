import { createContext, useContext, useState } from "react";
import {
    ToastProvider as ShadcnToastProvider,
    ToastViewport,
    Toast,
    ToastTitle,
    ToastDescription,
    ToastClose
} from "@/components/ui/toast";

type ToastType = "default" | "destructive" | "success";

type ToastOptions = {
    title?: string;
    description?: string;
    type?: ToastType;
    duration?: number;
};

type ToastContextType = {
    showToast: (options: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType>({
    showToast: () => { },
});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<(ToastOptions & { id: string })[]>([]);

    const showToast = (options: ToastOptions) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { ...options, id }]);

        setTimeout(() => {
            setToasts((prev) => prev.filter((toast) => toast.id !== id));
        }, options.duration || 5000);
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            <ShadcnToastProvider>
                {children}
                {toasts.map((toast) => (
                    <Toast key={toast.id} variant={toast.type || "default"}>
                        <div className="grid gap-1">
                            {toast.title && <ToastTitle>{toast.title}</ToastTitle>}
                            {toast.description && <ToastDescription>{toast.description}</ToastDescription>}
                        </div>
                        <ToastClose />
                    </Toast>
                ))}
                <ToastViewport />
            </ShadcnToastProvider>
        </ToastContext.Provider>
    );
}
