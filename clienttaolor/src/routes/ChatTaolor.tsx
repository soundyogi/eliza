import Chat from "@/components/chat";

export default function ChatTaolor() {
    const agentId = "2097715f-e41a-0b67-868d-90df38e959fa"

    if (!agentId) return <div>No data.</div>;

    return <Chat agentId={agentId} />;
}
