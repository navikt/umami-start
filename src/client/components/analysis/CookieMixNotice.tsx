import { format } from 'date-fns';
import { nb } from 'date-fns/locale';
import InfoCard from '../InfoCard.tsx';

type CookieMixNoticeProps = {
    websiteName?: string | null;
    cookieStartDate?: Date | null;
    variant?: 'mix' | 'pre';
};

const CookieMixNotice = ({ websiteName, cookieStartDate, variant = 'mix' }: CookieMixNoticeProps) => {
    const title = variant === 'pre'
        ? 'Merk: Identiisering av brukere uten cookies'
        : 'Merk: Blanding av metoder for identifisering av brukere';
    const content = variant === 'pre'
        ? `${websiteName || 'denne siden'} startet måling med cookies ${cookieStartDate ? format(cookieStartDate, 'd. MMMM yyyy', { locale: nb }) : 'i denne perioden'}. Perioden du har valgt er før dette, så brukere identifiseres uten cookies.`
        : `${websiteName || 'denne siden'} startet måling og sammenkobling av events på brukernivå på tvers av kalendermåneder ${cookieStartDate ? format(cookieStartDate, 'd. MMMM yyyy', { locale: nb }) : 'i denne perioden'}. Perioden du har valgt dekker både tiden før og etter.`;
    return (
        <InfoCard data-color="info" className="mb-4">
            <InfoCard.Header>
                <InfoCard.Title>{title}</InfoCard.Title>
            </InfoCard.Header>
            <InfoCard.Content>
                {content}
            </InfoCard.Content>
        </InfoCard>
    );
};

export default CookieMixNotice;
