/**
 * The Shiv Tandav Stotram (attributed to Ravana; public domain), one entry
 * per half-verse — the unit most recitations breathe in.
 *
 * Devanagari and IAST follow the common recension; recordings vary, so any
 * line's text can be overridden from the lyrics timing file. The English is an
 * original, deliberately brief rendering for display.
 *
 * `motifs` tag the imagery of each line. When a line is sung, the director
 * turns those words into visual events — the fire on his brow blazes on
 * "dhagad dhagad", serpents glow on "bhujaṅga", each epithet of the destroyer
 * lands as a shockwave.
 */

export type Motif =
  | 'ganga' // the celestial river in his locks
  | 'serpent'
  | 'moon' // the crescent on his crown
  | 'fire'
  | 'thirdEye'
  | 'damaru'
  | 'drum' // dhimid dhimid — the mridanga
  | 'tandav' // the dance itself is named
  | 'throat' // Neelakantha, the dark-blue throat
  | 'storm'
  | 'destroyer' // the litany of what he cut down / ended
  | 'radiance'
  | 'calm'
  | 'blessing'

export interface StotramLine {
  id: string
  verse: number
  deva: string
  iast: string
  en: string
  motifs: Motif[]
  /** Sung only in some recordings. */
  optional?: boolean
}

export const STOTRAM: StotramLine[] = [
  {
    id: '1a',
    verse: 1,
    deva: 'जटाटवीगलज्जलप्रवाहपावितस्थले गलेऽवलम्ब्य लम्बितां भुजङ्गतुङ्गमालिकाम्',
    iast: 'jaṭāṭavī-galaj-jala-pravāha-pāvita-sthale gale’valambya lambitāṃ bhujaṅga-tuṅga-mālikām',
    en: 'Where the waters falling from his forest of locks hallow the ground, a great garland of serpents hangs at his throat',
    motifs: ['ganga', 'serpent'],
  },
  {
    id: '1b',
    verse: 1,
    deva: 'डमड्डमड्डमड्डमन्निनादवड्डमर्वयं चकार चण्डताण्डवं तनोतु नः शिवः शिवम्',
    iast: 'ḍamaḍ-ḍamaḍ-ḍamaḍ-ḍaman-ninādavaḍ-ḍamarvayaṃ cakāra caṇḍa-tāṇḍavaṃ tanotu naḥ śivaḥ śivam',
    en: 'To the damaru’s ḍamaḍ ḍamaḍ he danced the fierce Tandav — may Shiva grant us all that is auspicious',
    motifs: ['damaru', 'tandav'],
  },
  {
    id: '2a',
    verse: 2,
    deva: 'जटाकटाहसम्भ्रमभ्रमन्निलिम्पनिर्झरी विलोलवीचिवल्लरीविराजमानमूर्धनि',
    iast: 'jaṭā-kaṭāha-sambhrama-bhraman-nilimpa-nirjharī vilola-vīci-vallarī-virājamāna-mūrdhani',
    en: 'His head shines with the restless waves of the heavenly river, whirling in the cauldron of his locks',
    motifs: ['ganga'],
  },
  {
    id: '2b',
    verse: 2,
    deva: 'धगद्धगद्धगज्ज्वलल्ललाटपट्टपावके किशोरचन्द्रशेखरे रतिः प्रतिक्षणं मम',
    iast: 'dhagad-dhagad-dhagaj-jvalal-lalāṭa-paṭṭa-pāvake kiśora-candra-śekhare ratiḥ pratikṣaṇaṃ mama',
    en: 'Fire blazes dhagad dhagad upon his brow, the young moon crowns him — my delight in him, at every moment',
    motifs: ['fire', 'thirdEye', 'moon'],
  },
  {
    id: '3a',
    verse: 3,
    deva: 'धराधरेन्द्रनन्दिनीविलासबन्धुबन्धुर स्फुरद्दिगन्तसन्ततिप्रमोदमानमानसे',
    iast: 'dharādharendra-nandinī-vilāsa-bandhu-bandhura sphurad-diganta-santati-pramodamāna-mānase',
    en: 'His heart delights in the play of the Mountain’s daughter, and in the radiance that fills every horizon',
    motifs: ['radiance'],
  },
  {
    id: '3b',
    verse: 3,
    deva: 'कृपाकटाक्षधोरणीनिरुद्धदुर्धरापदि क्वचिद्दिगम्बरे मनो विनोदमेतु वस्तुनि',
    iast: 'kṛpā-kaṭākṣa-dhoraṇī-niruddha-durdharāpadi kvacid-digambare mano vinodam-etu vastuni',
    en: 'His glance of grace holds back unbearable calamity — may my mind find joy in him who is clothed by the sky',
    motifs: ['calm'],
  },
  {
    id: '4a',
    verse: 4,
    deva: 'जटाभुजङ्गपिङ्गलस्फुरत्फणामणिप्रभा कदम्बकुङ्कुमद्रवप्रलिप्तदिग्वधूमुखे',
    iast: 'jaṭā-bhujaṅga-piṅgala-sphurat-phaṇā-maṇi-prabhā kadamba-kuṅkuma-drava-pralipta-digvadhū-mukhe',
    en: 'The jewels on the hoods of the serpents in his locks paint the faces of the directions with saffron light',
    motifs: ['serpent', 'radiance'],
  },
  {
    id: '4b',
    verse: 4,
    deva: 'मदान्धसिन्धुरस्फुरत्त्वगुत्तरीयमेदुरे मनो विनोदमद्भुतं बिभर्तु भूतभर्तरि',
    iast: 'madāndha-sindhura-sphurat-tvag-uttarīya-medure mano vinodam-adbhutaṃ bibhartu bhūta-bhartari',
    en: 'Wrapped in the hide of a maddened elephant — may my mind hold a wondrous joy in the lord of all beings',
    motifs: ['tandav'],
  },
  {
    id: '5a',
    verse: 5,
    deva: 'सहस्रलोचनप्रभृत्यशेषलेखशेखर प्रसूनधूलिधोरणी विधूसराङ्घ्रिपीठभूः',
    iast: 'sahasra-locana-prabhṛty-aśeṣa-lekha-śekhara prasūna-dhūli-dhoraṇī vidhūsarāṅghri-pīṭha-bhūḥ',
    en: 'His footstool is grey with pollen fallen from the flowers on the heads of Indra and every god bowing before him',
    motifs: ['blessing'],
  },
  {
    id: '5b',
    verse: 5,
    deva: 'भुजङ्गराजमालया निबद्धजाटजूटकः श्रियै चिराय जायतां चकोरबन्धुशेखरः',
    iast: 'bhujaṅga-rāja-mālayā nibaddha-jāṭa-jūṭakaḥ śriyai cirāya jāyatāṃ cakora-bandhu-śekharaḥ',
    en: 'His locks bound by the king of serpents, the moon upon his crown — may he bring lasting fortune',
    motifs: ['serpent', 'moon'],
  },
  {
    id: '6a',
    verse: 6,
    deva: 'ललाटचत्वरज्वलद्धनञ्जयस्फुलिङ्गभा निपीतपञ्चसायकं नमन्निलिम्पनायकम्',
    iast: 'lalāṭa-catvara-jvalad-dhanañjaya-sphuliṅga-bhā nipīta-pañca-sāyakaṃ naman-nilimpa-nāyakam',
    en: 'With sparks from the fire on his brow he consumed the god of desire; the lords of heaven bow before him',
    motifs: ['thirdEye', 'fire'],
  },
  {
    id: '6b',
    verse: 6,
    deva: 'सुधामयूखलेखया विराजमानशेखरं महाकपालिसम्पदेशिरोजटालमस्तु नः',
    iast: 'sudhā-mayūkha-lekhayā virājamāna-śekharaṃ mahā-kapāli-sampade śiro-jaṭālam-astu naḥ',
    en: 'Crowned by the nectar-rayed crescent, the great ascetic with matted locks — may his riches be ours',
    motifs: ['moon'],
  },
  {
    id: '7a',
    verse: 7,
    deva: 'करालभालपट्टिकाधगद्धगद्धगज्ज्वल द्धनञ्जयाहुतीकृतप्रचण्डपञ्चसायके',
    iast: 'karāla-bhāla-paṭṭikā-dhagad-dhagad-dhagaj-jvalad dhanañjayāhutī-kṛta-pracaṇḍa-pañca-sāyake',
    en: 'On his terrible brow fire roars dhagad dhagad, and the mighty god of desire is offered into its flame',
    motifs: ['fire', 'thirdEye'],
  },
  {
    id: '7b',
    verse: 7,
    deva: 'धराधरेन्द्रनन्दिनीकुचाग्रचित्रपत्रक प्रकल्पनैकशिल्पिनि त्रिलोचने रतिर्मम',
    iast: 'dharādharendra-nandinī-kucāgra-citra-patraka prakalpanaika-śilpini trilocane ratir-mama',
    en: 'The Three-Eyed One, sole artist of the Goddess’s adornment — in him is my delight',
    motifs: ['thirdEye', 'calm'],
  },
  {
    id: '8a',
    verse: 8,
    deva: 'नवीनमेघमण्डलीनिरुद्धदुर्धरस्फुरत् कुहूनिशीथिनीतमःप्रबन्धबद्धकन्धरः',
    iast: 'navīna-megha-maṇḍalī-niruddha-durdhara-sphurat kuhū-niśīthinī-tamaḥ-prabandha-baddha-kandharaḥ',
    en: 'His throat is dark as a moonless midnight wrapped in fresh storm clouds',
    motifs: ['storm', 'throat'],
  },
  {
    id: '8b',
    verse: 8,
    deva: 'निलिम्पनिर्झरीधरस्तनोतु कृत्तिसिन्धुरः कलानिधानबन्धुरः श्रियं जगद्धुरन्धरः',
    iast: 'nilimpa-nirjharī-dharas-tanotu kṛtti-sindhuraḥ kalā-nidhāna-bandhuraḥ śriyaṃ jagad-dhurandharaḥ',
    en: 'Bearer of the heavenly river, beautiful with the moon — may he who upholds the world grant prosperity',
    motifs: ['ganga', 'moon'],
  },
  {
    id: '9a',
    verse: 9,
    deva: 'प्रफुल्लनीलपङ्कजप्रपञ्चकालिमप्रभा वलम्बिकण्ठकन्दलीरुचिप्रबद्धकन्धरम्',
    iast: 'praphulla-nīla-paṅkaja-prapañca-kālima-prabhā valambi-kaṇṭha-kandalī-ruci-prabaddha-kandharam',
    en: 'His neck glows with the deep darkness of blooming blue lotuses',
    motifs: ['throat'],
  },
  {
    id: '9b',
    verse: 9,
    deva: 'स्मरच्छिदं पुरच्छिदं भवच्छिदं मखच्छिदं गजच्छिदान्धकच्छिदं तमन्तकच्छिदं भजे',
    iast: 'smara-cchidaṃ pura-cchidaṃ bhava-cchidaṃ makha-cchidaṃ gaja-cchidāndhaka-cchidaṃ tam-antaka-cchidaṃ bhaje',
    en: 'I worship him who cut down desire, the three cities, worldly bondage, the sacrifice, the elephant demon, Andhaka — and Death itself',
    motifs: ['destroyer'],
  },
  {
    id: '10a',
    verse: 10,
    deva: 'अखर्वसर्वमङ्गलाकलाकदम्बमञ्जरी रसप्रवाहमाधुरीविजृम्भणामधुव्रतम्',
    iast: 'akharva-sarva-maṅgalā-kalā-kadamba-mañjarī rasa-pravāha-mādhurī-vijṛmbhaṇā-madhuvratam',
    en: 'Like a bee drawn to the sweetness flowing from the blossoms of every auspicious art',
    motifs: ['radiance'],
  },
  {
    id: '10b',
    verse: 10,
    deva: 'स्मरान्तकं पुरान्तकं भवान्तकं मखान्तकं गजान्तकान्धकान्तकं तमन्तकान्तकं भजे',
    iast: 'smarāntakaṃ purāntakaṃ bhavāntakaṃ makhāntakaṃ gajāntakāndhakāntakaṃ tam-antakāntakaṃ bhaje',
    en: 'I worship the ender of desire, of the cities, of bondage, of the sacrifice, of the elephant demon, of Andhaka — the ender of Death',
    motifs: ['destroyer'],
  },
  {
    id: '11a',
    verse: 11,
    deva: 'जयत्वदभ्रविभ्रमभ्रमद्भुजङ्गमश्वस द्विनिर्गमत्क्रमस्फुरत्करालभालहव्यवाट्',
    iast: 'jayatv-adabhra-vibhrama-bhramad-bhujaṅgama-śvasad vinirgamat-krama-sphurat-karāla-bhāla-havyavāṭ',
    en: 'Victory to him — serpents whirl across the sky, and their breath fans the fierce fire upon his brow',
    motifs: ['serpent', 'fire', 'thirdEye'],
  },
  {
    id: '11b',
    verse: 11,
    deva: 'धिमिद्धिमिद्धिमिध्वनन्मृदङ्गतुङ्गमङ्गल ध्वनिक्रमप्रवर्तितप्रचण्डताण्डवः शिवः',
    iast: 'dhimid-dhimid-dhimi-dhvanan-mṛdaṅga-tuṅga-maṅgala dhvani-krama-pravartita-pracaṇḍa-tāṇḍavaḥ śivaḥ',
    en: 'To the great drum’s dhimid dhimid, Shiva sets the fierce Tandav in motion',
    motifs: ['drum', 'tandav'],
  },
  {
    id: '12a',
    verse: 12,
    deva: 'दृषद्विचित्रतल्पयोर्भुजङ्गमौक्तिकस्रजो र्गरिष्ठरत्नलोष्ठयोः सुहृद्विपक्षपक्षयोः',
    iast: 'dṛṣad-vicitra-talpayor bhujaṅga-mauktika-srajor gariṣṭha-ratna-loṣṭhayoḥ suhṛd-vipakṣa-pakṣayoḥ',
    en: 'A bed of stone or of silk, a serpent or a string of pearls, a priceless gem or a clod of earth, friend or foe —',
    motifs: ['calm'],
  },
  {
    id: '12b',
    verse: 12,
    deva: 'तृणारविन्दचक्षुषोः प्रजामहीमहेन्द्रयोः समं प्रवर्तयन्मनः कदा सदाशिवं भजे',
    iast: 'tṛṇāravinda-cakṣuṣoḥ prajā-mahī-mahendrayoḥ samaṃ pravartayan-manaḥ kadā sadāśivaṃ bhaje',
    en: 'a blade of grass or lotus eyes, subject or emperor — seeing all as one, when shall I worship Sadashiva?',
    motifs: ['calm'],
  },
  {
    id: '13a',
    verse: 13,
    deva: 'कदा निलिम्पनिर्झरीनिकुञ्जकोटरे वसन् विमुक्तदुर्मतिः सदा शिरःस्थमञ्जलिं वहन्',
    iast: 'kadā nilimpa-nirjharī-nikuñja-koṭare vasan vimukta-durmatiḥ sadā śiraḥ-stham-añjaliṃ vahan',
    en: 'When, dwelling in a grove by the heavenly river, free of ill thought, my joined hands raised above my head,',
    motifs: ['ganga', 'calm'],
  },
  {
    id: '13b',
    verse: 13,
    deva: 'विलोललोललोचनो ललामभाललग्नकः शिवेति मन्त्रमुच्चरन् कदा सुखी भवाम्यहम्',
    iast: 'vilola-lola-locano lalāma-bhāla-lagnakaḥ śiveti mantram-uccaran kadā sukhī bhavāmy-aham',
    en: 'my eyes wandering, chanting the mantra “Shiva”, when shall I know peace?',
    motifs: ['calm'],
  },
  {
    id: 'x1a',
    verse: 14,
    optional: true,
    deva: 'निलिम्पनाथनागरीकदम्बमौलमल्लिका निगुम्फनिर्भरक्षरन्मधूष्णिकामनोहरः',
    iast: 'nilimpa-nātha-nāgarī-kadamba-maula-mallikā nigumpha-nirbhara-kṣaran-madhūṣṇikā-manoharaḥ',
    en: 'Lovely with the honey falling from the jasmine garlands of the celestial maidens,',
    motifs: ['radiance'],
  },
  {
    id: 'x1b',
    verse: 14,
    optional: true,
    deva: 'तनोतु नो मनोमुदं विनोदिनीमहर्निशं परश्रियः परं पदं तदङ्गजत्विषां चयः',
    iast: 'tanotu no mano-mudaṃ vinodinīm-aharniśaṃ para-śriyaḥ paraṃ padaṃ tad-aṅga-ja-tviṣāṃ cayaḥ',
    en: 'may the radiance of his body, the highest seat of splendour, delight our hearts day and night',
    motifs: ['radiance', 'blessing'],
  },
  {
    id: 'x2a',
    verse: 15,
    optional: true,
    deva: 'प्रचण्डवाडवानलप्रभाशुभप्रचारणी महाष्टसिद्धिकामिनीजनावहूतजल्पना',
    iast: 'pracaṇḍa-vāḍavānala-prabhā-śubha-pracāriṇī mahāṣṭa-siddhi-kāminī-janāvahūta-jalpanā',
    en: 'Blazing like the fire beneath the ocean, the auspicious sound that summons every power,',
    motifs: ['fire', 'radiance'],
  },
  {
    id: 'x2b',
    verse: 15,
    optional: true,
    deva: 'विमुक्तवामलोचनाविवाहकालिकध्वनिः शिवेति मन्त्रभूषणा जगज्जयाय जायताम्',
    iast: 'vimukta-vāma-locanā-vivāha-kālika-dhvaniḥ śiveti mantra-bhūṣaṇā jagaj-jayāya jāyatām',
    en: 'adorned by the mantra “Shiva” — may it bring victory to the world',
    motifs: ['blessing'],
  },
  {
    id: '14a',
    verse: 16,
    deva: 'इमं हि नित्यमेवमुक्तमुत्तमोत्तमं स्तवं पठन्स्मरन्ब्रुवन्नरो विशुद्धिमेति सन्ततम्',
    iast: 'imaṃ hi nityam-evam-uktam-uttamottamaṃ stavaṃ paṭhan smaran bruvan naro viśuddhim-eti santatam',
    en: 'Whoever reads, remembers or recites this supreme hymn is purified for ever,',
    motifs: ['blessing'],
  },
  {
    id: '14b',
    verse: 16,
    deva: 'हरे गुरौ सुभक्तिमाशु याति नान्यथा गतिं विमोहनं हि देहिनां सुशङ्करस्य चिन्तनम्',
    iast: 'hare gurau su-bhaktim-āśu yāti nānyathā gatiṃ vimohanaṃ hi dehināṃ su-śaṅkarasya cintanam',
    en: 'and swiftly finds devotion to Hara; there is no other way — to dwell on Shankara frees all beings from delusion',
    motifs: ['blessing', 'calm'],
  },
  {
    id: '15a',
    verse: 17,
    deva: 'पूजावसानसमये दशवक्त्रगीतं यः शम्भुपूजनपरं पठति प्रदोषे',
    iast: 'pūjāvasāna-samaye daśa-vaktra-gītaṃ yaḥ śambhu-pūjana-paraṃ paṭhati pradoṣe',
    en: 'Whoever, as worship closes at dusk, recites this song of the ten-headed one devoted to Shambhu,',
    motifs: ['blessing'],
  },
  {
    id: '15b',
    verse: 17,
    deva: 'तस्य स्थिरां रथगजेन्द्रतुरङ्गयुक्तां लक्ष्मीं सदैव सुमुखीं प्रददाति शम्भुः',
    iast: 'tasya sthirāṃ ratha-gajendra-turaṅga-yuktāṃ lakṣmīṃ sadaiva sumukhīṃ pradadāti śambhuḥ',
    en: 'to them Shambhu grants steady, smiling fortune — chariots, elephants and horses.',
    motifs: ['blessing'],
  },
]

export const STOTRAM_BY_ID = new Map(STOTRAM.map((l) => [l.id, l]))
