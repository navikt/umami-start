import {List, Link} from "@navikt/ds-react";

export default function Kontaktboks() {
    return (
        <>
            <List as="ul" title="Spørsmål?" className="pt-2">
                <List.Item>
                    <strong>Slack:</strong> Bli med i kanalen <Link
                    href={"https://nav-it.slack.com/archives/C070BPKR830"} target={"_blank"}>#produktanalyse</Link> og <Link
                    href={"https://nav-it.slack.com/archives/C02UGFS2J4B"} target={"_blank"}>#researchops</Link>.
                </List.Item>
                <List.Item>
                    <strong>Samtale:</strong> <Link
                    href={"https://outlook.office365.com/owa/calendar/TeamResearchOps@nav.no/bookings/"} target={"_blank"}>Book en prat
                    1:1 eller workshop</Link>.
                </List.Item>
            </List>
        </>
    );
}