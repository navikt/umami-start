import {Heading} from "@navikt/ds-react";
import Metadashboard from "../components/metadashboard.tsx";

function Sok() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px", marginBottom: "30px" }}>Nav webstatistikk</Heading>
            <Metadashboard/>
        </>
    )
}

export default Sok