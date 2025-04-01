import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "./components/ui/toaster";
import useVersion from "./hooks/use-version";
import ChatTaolor from "./routes/ChatTaolor";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: Number.POSITIVE_INFINITY,
        },
    },
});

function App() {
    useVersion();
    return (
        <QueryClientProvider client={queryClient}>
            <div
                className="dark antialiased"
                style={{
                    colorScheme: "dark",
                }}
            >
                <TooltipProvider delayDuration={0}>
                    <ChatTaolor />
                    <Toaster />
                </TooltipProvider>
            </div>
        </QueryClientProvider>
    );
}

export default App;
