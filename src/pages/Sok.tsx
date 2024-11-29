import {Heading} from "@navikt/ds-react";
import Dashboard from "../components/dashboard.tsx";

function Sok() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px", marginBottom: "30px" }}>Nav webstatistikk</Heading>
            <Dashboard/>
        </>
    )
}

export default Sok