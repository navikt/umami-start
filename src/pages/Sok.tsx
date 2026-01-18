import { Heading } from "@navikt/ds-react";
import UrlSearchForm from "../components/dashboard/UrlSearchForm";

function Sok() {
    return (
        <>
            <Heading spacing={true} as="h2" size="large" style={{ marginTop: "60px", marginBottom: "30px" }}>Nav webstatistikk</Heading>
            <UrlSearchForm />
        </>
    )
}

export default Sok