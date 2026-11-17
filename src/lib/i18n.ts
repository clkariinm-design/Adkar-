export type AppLang = 'so' | 'en';

export interface Translations {
  appName: string;
  welcome: {
    bismillah: string;
    greeting: string;
    subtitle: string;
    featureQuran: string;
    featureAdhkar: string;
    featureTasbih: string;
    cta: string;
    starting: string;
    anonDisabledTitle: string;
    anonDisabledDesc: string;
  };
  nav: {
    home: string;
    quran: string;
    adhkar: string;
    tasbih: string;
    account: string;
  };
  common: {
    save: string;
    cancel: string;
    delete: string;
    edit: string;
    reset: string;
    search: string;
    loading: string;
    retry: string;
    close: string;
    back: string;
    next: string;
    previous: string;
    all: string;
    favorites: string;
    lightMode: string;
    darkMode: string;
    somali: string;
    english: string;
    today: string;
    of: string;
  };
  home: {
    salam: string;
    subtitleSignedIn: string;
    resumeReading: string;
    noProgressYet: string;
    startQuran: string;
    recentlyRead: string;
    dailyGoalsTitle: string;
    dailyTargetLabel: string;
    completedToday: string;
    editGoal: string;
    quickAccess: string;
    quranCardDesc: string;
    adhkarCardDesc: string;
    tasbihCardDesc: string;
    remindersCardTitle: string;
    noReminders: string;
    manageReminders: string;
    surahsCountLabel: string;
    adhkarTodayLabel: string;
    tasbihTodayLabel: string;
    dueNowLabel: string;
  };
  quran: {
    title: string;
    searchSurahsPlaceholder: string;
    searchVersesPlaceholder: string;
    modeSurahs: string;
    modeVerseSearch: string;
    modeBookmarks: string;
    meccan: string;
    medinan: string;
    versesLabel: string;
    resumeBanner: string;
    continueFrom: string;
    pageLabel: string;
    fontSize: string;
    bookmarkAdded: string;
    bookmarkRemoved: string;
    addNotePlaceholder: string;
    saveBookmark: string;
    removeBookmark: string;
    markLastRead: string;
    lastReadSaved: string;
    footnotes: string;
    hideFootnotes: string;
    noBookmarks: string;
    noBookmarksDesc: string;
    searchHint: string;
    noSearchResults: string;
    attributionLabel: string;
    sajdaLabel: string;
  };
  adhkar: {
    title: string;
    subtitle: string;
    allCategories: string;
    favoritesOnly: string;
    repeatGoal: string;
    completed: string;
    tapToCount: string;
    resetCount: string;
    reference: string;
    virtue: string;
    viewSource: string;
    noItemsInCategory: string;
    noFavorites: string;
    favoriteAdded: string;
    favoriteRemoved: string;
  };
  tasbih: {
    title: string;
    subtitle: string;
    selectCounter: string;
    newCounter: string;
    counterTitlePlaceholder: string;
    arabicOptionalLabel: string;
    arabicPlaceholder: string;
    targetLabel: string;
    createCounter: string;
    tapToIncrement: string;
    currentRound: string;
    totalCount: string;
    saveSession: string;
    sessionSaved: string;
    resetRound: string;
    historyTitle: string;
    noHistory: string;
    noCounters: string;
    loadPresets: string;
    deleteCounter: string;
    targetReached: string;
  };
  account: {
    title: string;
    subtitle: string;
    tabProfile: string;
    tabReminders: string;
    displayNameLabel: string;
    displayNamePlaceholder: string;
    profileSectionTitle: string;
    languageLabel: string;
    timezoneLabel: string;
    useDeviceTimezone: string;
    profileSaved: string;
    dailyGoalTitle: string;
    dailyGoalDesc: string;
    dailyGoalSaved: string;
    statsBookmarks: string;
    statsFavorites: string;
    statsTasbih: string;
    remindersTitle: string;
    remindersHonestNote: string;
    addReminder: string;
    reminderTypeLabel: string;
    reminderTimeLabel: string;
    weekdaysLabel: string;
    enabledLabel: string;
    reminderSaved: string;
    reminderDeleted: string;
    noRemindersYet: string;
    types: {
      morning: string;
      evening: string;
      quran: string;
      custom: string;
    };
    appVersionLabel: string;
    contentSourcesTitle: string;
  };
  offline: {
    offlineBadge: string;
    onlineBadge: string;
    pendingSync: string;
    syncing: string;
    syncNow: string;
    syncError: string;
    syncedSuccess: string;
    cachedOfflineHint: string;
    cacheAllQuran: string;
    cachingQuran: string;
    quranCachedCount: string;
  };
  maintenance: {
    title: string;
    defaultMessage: string;
    expectedEnd: string;
  };
  updates: {
    title: string;
    mandatoryBadge: string;
    optionalBadge: string;
    currentVersion: string;
    latestVersion: string;
    minSupported: string;
    releaseNotes: string;
    downloadApk: string;
    noApkUrl: string;
    androidLimitationsTitle: string;
    androidLimitationsBody: string;
    confirmDownload: string;
    upToDate: string;
    checkUpdates: string;
  };
  khatmah: {
    title: string;
    tabLabel: string;
    subtitle: string;
    introTitle: string;
    introBody: string;
    startBtn: string;
    createTitle: string;
    planNameLabel: string;
    planNamePlaceholder: string;
    durationLabel: string;
    daysUnit: string;
    versesPerDayApprox: string;
    startDateLabel: string;
    targetEndDateLabel: string;
    confirmCreate: string;
    creating: string;
    activePlanExistsErr: string;
    planCreated: string;
    planPaused: string;
    planResumed: string;
    planCompletedToast: string;
    progressTitle: string;
    completedDaysLabel: string;
    remainingDaysLabel: string;
    versesCompletedLabel: string;
    todayPlanTitle: string;
    continueReading: string;
    markCompleted: string;
    confirmCompleteTitle: string;
    confirmCompleteBody: string;
    confirmCompleteAction: string;
    alreadyCompleted: string;
    completedSuccess: string;
    queuedOfflineSuccess: string;
    pauseBtn: string;
    resumeBtn: string;
    pauseConfirmBody: string;
    scheduleTitle: string;
    plansTitle: string;
    historyTitle: string;
    filterAll: string;
    filterRemaining: string;
    filterCompleted: string;
    dayPrefix: string;
    versesCountUnit: string;
    statusCompleted: string;
    statusCurrent: string;
    statusUpcoming: string;
    statusActive: string;
    statusPaused: string;
    statusDone: string;
    statusCancelled: string;
    noSchedule: string;
    noPlans: string;
    noHistory: string;
    pausedNotice: string;
    completedBannerTitle: string;
    completedBannerBody: string;
    queuedSyncNote: string;
    duplicateLogError: string;
    homeCardCtaEmpty: string;
    homeCardEmptyDesc: string;
    openTracker: string;
    allDaysDone: string;
  };
}

export const translations: Record<AppLang, Translations> = {
  so: {
    appName: 'NUUR',
    welcome: {
      bismillah: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      greeting: 'Assalaamu Calaykum, Ku Soo Dhawoow NUUR',
      subtitle:
        'Hoygaaga deggan ee Qur’aanka Kariimka, Adkaarta sugan, Tasbiixda dhijitaalka ah iyo xasuusinta cibaadada — bilaa diiwaangelin iyo erey sir ah.',
      featureQuran: '114 Suuradood & Tarjumaad Soomaali ah',
      featureAdhkar: 'Adkaarta Subaxda, Fiidka & Salaadda Kadib',
      featureTasbih: 'Tasbiix Dhijitaal ah & Kaydinta Horumarka',
      cta: 'Bilow isticmaalka',
      starting: 'Waa la diyaarinayaa...',
      anonDisabledTitle: 'Gelitaanka degdegga ah (Anonymous Auth) weli ma furmin',
      anonDisabledDesc:
        'Mashruuca Supabase (krhuhunxxogrvhohjljh) hadda kama shidna "Allow anonymous sign-ins". Fadlan ka shid Supabase Dashboard -> Authentication -> Providers/Settings si aad u bilowdo.',
    },
    nav: {
      home: 'Hoyga',
      quran: "Qur'aanka",
      adhkar: 'Adkaarta',
      tasbih: 'Tasbiixda',
      account: 'Dejinta',
    },
    common: {
      save: 'Kaydi',
      cancel: 'Jooji',
      delete: 'Tirtir',
      edit: 'Wax Ka Beddel',
      reset: 'Dib U Bilow',
      search: 'Raadi',
      loading: 'Waa la soo rarayaa...',
      retry: 'Isku Day Mar Kale',
      close: 'Xir',
      back: 'Dib U Noqo',
      next: 'Xiga',
      previous: 'Hore',
      all: 'Dhammaan',
      favorites: 'Kuwa La Jecel Yahay',
      lightMode: 'Iftiin',
      darkMode: 'Mugdi',
      somali: 'Soomaali',
      english: 'English',
      today: 'Maanta',
      of: 'ka mid ah',
    },
    home: {
      salam: 'Assalaamu Calaykum',
      subtitleSignedIn: 'Ku soo dhawoow NUUR. Sii wad akhrintaada iyo dikriga maanta.',
      resumeReading: 'Sii Wad Akhrinta',
      noProgressYet: 'Weli ma aadan bilaabin akhrinta Qur’aanka.',
      startQuran: 'Bilow Suuradda Al-Faatixa',
      recentlyRead: 'Aayaddii Ugu Dambeysay Ee La Akhriyay',
      dailyGoalsTitle: 'Yoolka Maalinlaha Ah',
      dailyTargetLabel: 'Bartilmaameedka Maanta',
      completedToday: 'Waxqabadka Maanta',
      editGoal: 'Beddel Yoolka',
      quickAccess: 'Helitaan Degdeg Ah',
      quranCardDesc: 'Dhammaan 114 suuradood oo leh qoraalka Cuthmaani iyo tarjumaadda Soomaaliga.',
      adhkarCardDesc: 'Adkaarta subaxda, fiidka, salaadda kadib iyo xuska maalinlaha ah.',
      tasbihCardDesc: 'Tasbiix dhijitaal ah oo leh bartilmaameed iyo taariikh kaydsan.',
      remindersCardTitle: 'Xasuusinta Jadwalka',
      noReminders: 'Ma jiraan xasuusinno firfircoon oo kuu qorsheysan.',
      manageReminders: 'Maaree Xasuusinta',
      surahsCountLabel: 'Suuradaha Qur’aanka',
      adhkarTodayLabel: 'Dikriga Maanta',
      tasbihTodayLabel: 'Tasbiixda Maanta',
      dueNowLabel: 'Waqti u dhow',
    },
    quran: {
      title: 'Qur’aanka Kariimka',
      searchSurahsPlaceholder: 'Raadi suurad (magac ama lambar)...',
      searchVersesPlaceholder: 'Raadi erey ku jira aayadaha ama tarjumaadda...',
      modeSurahs: 'Suuradaha',
      modeVerseSearch: 'Raadi Aayado',
      modeBookmarks: 'Calaamadaha',
      meccan: 'Makki',
      medinan: 'Madani',
      versesLabel: 'aayadood',
      resumeBanner: 'Halkii aad maraysay',
      continueFrom: 'Ka sii wad',
      pageLabel: 'Bogga',
      fontSize: 'Cabbirka Carabiga',
      bookmarkAdded: 'Aayadda waa la calaamadeeyay.',
      bookmarkRemoved: 'Calaamadda waa laga saaray.',
      addNotePlaceholder: 'Ku dar xusuus qor gaar ah (ikhtiyaari)...',
      saveBookmark: 'Kaydi Calaamadda',
      removeBookmark: 'Ka Saar Calaamadda',
      markLastRead: 'U Calaamadee Halkii Ugu Dambeysay',
      lastReadSaved: 'Horumarka akhrinta waa la kaydiyay.',
      footnotes: 'Faahfaahin & Sharraxaad',
      hideFootnotes: 'Qari Sharraxaadda',
      noBookmarks: 'Weli ma jirto aayad calaamadaysan',
      noBookmarksDesc: 'Riix astaanta calaamadda ee aayad kasta si aad hadhow si fudud ugu soo noqoto.',
      searchHint: 'Geli ugu yaraan 2 xaraf si aad uga dhex raadiso Qur’aanka.',
      noSearchResults: 'Wax natiijo ah lagama helin raadintaada.',
      attributionLabel: 'Tarjumaadda Soomaaliga',
      sajdaLabel: 'Sajda',
    },
    adhkar: {
      title: 'Adkaarta Maalinlaha Ah',
      subtitle: 'Adkaar sugan oo leh qoraal Carabi ah, ku dhawaaqid, tarjumaad Soomaali ah iyo tixraac.',
      allCategories: 'Dhammaan Qaybaha',
      favoritesOnly: 'Kuwa La Jecel Yahay',
      repeatGoal: 'Tirada Ku Celcelinta',
      completed: 'Waad dhammaysay',
      tapToCount: 'Taabo si aad u tiriso',
      resetCount: 'Dib U Bilow',
      reference: 'Tixraaca',
      virtue: 'Fadliga',
      viewSource: 'Eeg Isha',
      noItemsInCategory: 'Qaybtan weli laguma darin adkaar kaydka ku jirta.',
      noFavorites: 'Weli ma aadan calaamadeyn adkaar aad jeceshahay.',
      favoriteAdded: 'Waxaa lagu daray kuwa la jecel yahay.',
      favoriteRemoved: 'Waxaa laga saaray kuwa la jecel yahay.',
    },
    tasbih: {
      title: 'Tasbiixda Dhijitaalka Ah',
      subtitle: 'Ku tiri dikrigaaga bartilmaameed qeexan, una kaydi fadhiyadaada si joogto ah.',
      selectCounter: 'Dooro Dikri',
      newCounter: 'Dikri Cusub',
      counterTitlePlaceholder: 'Tusaale: SubhanAllah',
      arabicOptionalLabel: 'Qoraalka Carabiga (Ikhtiyaari)',
      arabicPlaceholder: 'Tusaale: سُبْحَانَ اللَّهِ',
      targetLabel: 'Bartilmaameedka',
      createCounter: 'Abuur Dikri',
      tapToIncrement: 'Taabo si aad u tiriso',
      currentRound: 'Wareegga Hadda',
      totalCount: 'Wadarta Guud',
      saveSession: 'Kaydi Fadhiga',
      sessionSaved: 'Fadhiga tasbiixda waa la kaydiyay.',
      resetRound: 'Eber Ka Dhig',
      historyTitle: 'Taariikhda Fadhiyada',
      noHistory: 'Weli ma jiro fadhi tasbiix ah oo la kaydiyay.',
      noCounters: 'Weli ma aadan samaysan miiska tasbiixda.',
      loadPresets: 'Ku Dar Dikriyada Caanka Ah',
      deleteCounter: 'Tirtir Tiriyaha',
      targetReached: 'Bartilmaameedka waa la gaaray',
    },
    account: {
      title: 'Dejinta & Xasuusinta',
      subtitle: 'Horumarkaaga, yoolka maalinlaha ah iyo xasuusinta waxay si gaar ah ugu kaydsan yihiin qalabkan.',
      tabProfile: 'Dejinta & Yoolka',
      tabReminders: 'Xasuusinta',
      displayNameLabel: 'Magaca (Ikhtiyaari)',
      displayNamePlaceholder: 'Magacaaga haddii aad rabto',
      profileSectionTitle: 'Doorbidyada Gaarka Ah',
      languageLabel: 'Luuqadda Barnaamijka',
      timezoneLabel: 'Aagga Waqtiga (Timezone)',
      useDeviceTimezone: 'Adeegso Waqtiga Qalabka',
      profileSaved: 'Doorbidyada waa la kaydiyay.',
      dailyGoalTitle: 'Yoolka Maanta',
      dailyGoalDesc: 'Deji tirada guud ee dikriga aad rabto inaad maanta gaarto.',
      dailyGoalSaved: 'Yoolka maanta waa la kaydiyay.',
      statsBookmarks: 'Aayado Calaamadaysan',
      statsFavorites: 'Adkaar La Jecel Yahay',
      statsTasbih: 'Fadhiyada Tasbiixda',
      remindersTitle: 'Jadwalka Xasuusinta',
      remindersHonestNote:
        'Jadwalka xasuusinta waxaa lagu kaydiyaa xisaabtaada iyadoo la raacayo aagga waqtigaaga. Xasuusinaha waqtigoodu dhow yahay waxay ka muuqan doonaan barnaamijka gudihiisa marka uu furan yahay.',
      addReminder: 'Ku Dar Xasuusin',
      reminderTypeLabel: 'Nooca Xasuusinta',
      reminderTimeLabel: 'Saacadda',
      weekdaysLabel: 'Maalmaha Toddobaadka',
      enabledLabel: 'Shidan',
      reminderSaved: 'Xasuusinta waa la kaydiyay.',
      reminderDeleted: 'Xasuusinta waa la tirtiray.',
      noRemindersYet: 'Weli ma aadan samaysan wax xasuusin ah.',
      types: {
        morning: 'Adkaarta Subaxda',
        evening: 'Adkaarta Fiidka',
        quran: 'Akhrinta Qur’aanka',
        custom: 'Xasuusin Gaar Ah',
      },
      appVersionLabel: 'Nooca Barnaamijka (Android)',
      contentSourcesTitle: 'Ilaha Nuxurka Rasmiga Ah',
    },
    offline: {
      offlineBadge: 'Khad la’aan (Offline)',
      onlineBadge: 'Khadka ku xiran',
      pendingSync: 'kayd aan weli la iswaafajin',
      syncing: 'Waa la iswaafajinayaa...',
      syncNow: 'Iswaafaji Hadda',
      syncError: 'Khalad iswaafajin',
      syncedSuccess: 'Xogtaada waa la iswaafajiyay.',
      cachedOfflineHint: 'Waxaa laga soo akhriyay kaydka qalabka (offline).',
      cacheAllQuran: 'U Kaydi Qur’aanka Offline',
      cachingQuran: 'Waa la kaydinayaa...',
      quranCachedCount: 'suuradood oo kaydsan',
    },
    maintenance: {
      title: 'Dayactir & Cusboonaysiin',
      defaultMessage: 'NUUR si ku-meel-gaar ah ayuu u xiran yahay. Fadlan dib u soo noqo.',
      expectedEnd: 'Waqtiga la filayo inuu soo noqdo',
    },
    updates: {
      title: 'Cusboonaysiin Android ah ayaa diyaar ah',
      mandatoryBadge: 'Cusboonaysiin Khasab ah',
      optionalBadge: 'Nooc Cusub',
      currentVersion: 'Nooca Hadda Kuu Jira',
      latestVersion: 'Nooca Ugu Dambeeya',
      minSupported: 'Ugu yaraan la taageero',
      releaseNotes: 'Waxyaabaha Cusub',
      downloadApk: 'Soo Deji APK (HTTPS)',
      noApkUrl: 'Xiriirka soo dejinta APK weli lama darin.',
      androidLimitationsTitle: 'Tilmaamaha Rakibidda Android APK',
      androidLimitationsBody:
        'Barnaamijku si qarsoodi ah uma rakibi karo APK. Marka aad xaqiijiso, biraawsarkaaga dibadda ayaa furi doona xiriirka HTTPS si aad u soo dejiso una xaqiijiso rakibidda Android (Install Unknown Apps haddii loo baahdo).',
      confirmDownload: 'Xaqiiji & Fur Soo Dejinta',
      upToDate: 'Barnaamijkaagu waa midka ugu dambeeya.',
      checkUpdates: 'Hubi Cusboonaysiinta',
    },
    khatmah: {
      title: 'Khatmadda Qur’aanka',
      tabLabel: 'Khatmadda',
      subtitle: 'Qorshee oo la soco dhammaystirka Qur’aanka Kariimka maalin kasta.',
      introTitle: 'Bilow Khatmad Cusub oo Qur’aan ah',
      introBody:
        'Dooro qorshe 30, 60 ama 90 maalmood ah si loo qaybiyo dhammaan 6,236-da aayadood ee Qur’aanka Kariimka, una akhri si joogto ah adigoo la soconaya horumarkaaga.',
      startBtn: 'Bilow Khatmad',
      createTitle: 'Abuur Qorshe Khatmad',
      planNameLabel: 'Magaca Qorshaha (Ikhtiyaari)',
      planNamePlaceholder: 'Tusaale: Khatmadda Bishan',
      durationLabel: 'Muddada Qorshaha',
      daysUnit: 'maalmood',
      versesPerDayApprox: 'aayadood/maalintii qiyaastii',
      startDateLabel: 'Taariikhda Bilowga',
      targetEndDateLabel: 'Taariikhda Dhammaadka La Qorsheeyay',
      confirmCreate: 'Bilow Khatmad',
      creating: 'Waa la samaynayaa...',
      activePlanExistsErr:
        'Waxaad horay u leedahay qorshe Khatmad ah oo firfircoon. Fadlan sii wad ama hakad geli ka hor intaadan mid cusub bilaabin.',
      planCreated: 'Qorshaha Khatmadda waa la bilaabay.',
      planPaused: 'Qorshaha Khatmadda waa la hakiyay.',
      planResumed: 'Qorshaha Khatmadda dib ayaa loo bilaabay.',
      planCompletedToast: 'MaashaAllaah! Khatmadda Qur’aanka oo dhan waad dhammaysay.',
      progressTitle: 'Horumarka Khatmadda',
      completedDaysLabel: 'Maalmaha Dhammaystiran',
      remainingDaysLabel: 'Maalmaha Haray',
      versesCompletedLabel: 'Aayadaha La Akhriyay',
      todayPlanTitle: 'Qorshaha Maanta',
      continueReading: 'Sii wad Akhriska',
      markCompleted: 'Maanta waan dhammeeyey',
      confirmCompleteTitle: 'Xaqiiji Dhammaystirka Maanta',
      confirmCompleteBody:
        'Ma hubtaa inaad si buuxda u akhriday qaybta aayadaha ee hoos ku xusan?',
      confirmCompleteAction: 'Haa, Waan Dhammeeyey',
      alreadyCompleted: 'Maalintan horay ayaa loo dhammeeyey.',
      completedSuccess: 'Alxamdulillaah! Akhrinta maanta waa la diiwaangeliyay.',
      queuedOfflineSuccess:
        'Akhrinta maanta waxaa lagu kaydiyay qalabka, waana la iswaafajin doonaa marka khadku soo noqdo.',
      pauseBtn: 'Hakad geli',
      resumeBtn: 'Dib u bilow',
      pauseConfirmBody:
        'Haddii aad hakad geliso qorshahan, horumarkaagu wuu kuu kaydsanaanayaa waxaadna dib u bilaabi kartaa mar kasta.',
      scheduleTitle: 'Jadwalka Maalinlaha Ah',
      plansTitle: 'Qorshayaasha Khatmadda',
      historyTitle: 'Taariikhda Akhriska',
      filterAll: 'Dhammaan',
      filterRemaining: 'Haray',
      filterCompleted: 'Dhammaystiran',
      dayPrefix: 'Maalinta',
      versesCountUnit: 'aayadood',
      statusCompleted: 'Dhammaystiran',
      statusCurrent: 'Hadda',
      statusUpcoming: 'Sugaya',
      statusActive: 'Firfircoon',
      statusPaused: 'Hakanaya',
      statusDone: 'La Dhammeeyey',
      statusCancelled: 'La Joojiyay',
      noSchedule: 'Jadwal looma helin qorshahan.',
      noPlans: 'Weli ma aadan samaysan qorshe Khatmad ah.',
      noHistory: 'Weli ma jiro akhrin Khatmad ah oo la diiwaangeliyay.',
      pausedNotice:
        'Qorshahan hadda wuu hakanayaa. Riix "Dib u bilow" si aad u sii waddo.',
      completedBannerTitle: 'Khatmaddu Way Dhammaystirantahay',
      completedBannerBody:
        'Dhammaan 6,236-da aayadood ee jadwalkan waa la dhammaystiray. Waxaad bilaabi kartaa Khatmad cusub goor kasta.',
      queuedSyncNote: 'Sugaya iswaafajinta (Offline)',
      duplicateLogError: 'Qaybtan horay ayaa loo diiwaangeliyay.',
      homeCardCtaEmpty: 'Bilow Khatmad',
      homeCardEmptyDesc: 'Deji yool 30, 60 ama 90 maalmood ah oo la soco akhrintaada.',
      openTracker: 'Fur Khatmadda',
      allDaysDone: 'Dhammaan maalmaha qorshahan waa la dhammaystiray.',
    },
  },
  en: {
    appName: 'NUUR',
    welcome: {
      bismillah: 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ',
      greeting: 'Assalamu Alaykum, Welcome to NUUR',
      subtitle:
        'Your tranquil companion for the Holy Quran, authentic daily Adhkar, Digital Tasbih, and worship reminders — with no registration or password required.',
      featureQuran: 'All 114 Surahs & Somali Translation',
      featureAdhkar: 'Morning, Evening & After-Prayer Adhkar',
      featureTasbih: 'Digital Tasbih & Saved Progress',
      cta: 'Bilow isticmaalka',
      starting: 'Preparing your space...',
      anonDisabledTitle: 'Anonymous sign-ins are disabled in Supabase',
      anonDisabledDesc:
        'The Supabase project (krhuhunxxogrvhohjljh) currently has "Allow anonymous sign-ins" disabled. Enable it in Supabase Dashboard -> Authentication -> Settings, then try again.',
    },
    nav: {
      home: 'Home',
      quran: 'Quran',
      adhkar: 'Adhkar',
      tasbih: 'Tasbih',
      account: 'Settings',
    },
    common: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      reset: 'Reset',
      search: 'Search',
      loading: 'Loading...',
      retry: 'Try Again',
      close: 'Close',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      all: 'All',
      favorites: 'Favorites',
      lightMode: 'Light',
      darkMode: 'Dark',
      somali: 'Soomaali',
      english: 'English',
      today: 'Today',
      of: 'of',
    },
    home: {
      salam: 'Assalamu Alaykum',
      subtitleSignedIn: 'Welcome to NUUR. Continue your Quran reading and daily remembrance.',
      resumeReading: 'Resume Reading',
      noProgressYet: 'You have not started reading the Quran yet.',
      startQuran: 'Start Surah Al-Faatiha',
      recentlyRead: 'Recently Read Verse',
      dailyGoalsTitle: 'Daily Goal',
      dailyTargetLabel: "Today's Target",
      completedToday: 'Completed Today',
      editGoal: 'Update Goal',
      quickAccess: 'Quick Access',
      quranCardDesc: 'All 114 Surahs with Uthmani Arabic script and Somali translation.',
      adhkarCardDesc: 'Morning, evening, after-prayer, and general remembrance with references.',
      tasbihCardDesc: 'Digital counter with custom dhikr targets and saved session history.',
      remindersCardTitle: 'Scheduled Reminders',
      noReminders: 'No active reminders scheduled yet.',
      manageReminders: 'Manage Reminders',
      surahsCountLabel: 'Quran Surahs',
      adhkarTodayLabel: 'Adhkar Today',
      tasbihTodayLabel: 'Tasbih Today',
      dueNowLabel: 'Upcoming',
    },
    quran: {
      title: 'The Holy Quran',
      searchSurahsPlaceholder: 'Search Surah by name or number...',
      searchVersesPlaceholder: 'Search verses in Arabic or translation...',
      modeSurahs: 'Surahs',
      modeVerseSearch: 'Search Verses',
      modeBookmarks: 'Bookmarks',
      meccan: 'Meccan',
      medinan: 'Medinan',
      versesLabel: 'verses',
      resumeBanner: 'Last Reading Position',
      continueFrom: 'Continue from',
      pageLabel: 'Page',
      fontSize: 'Arabic Size',
      bookmarkAdded: 'Verse bookmarked.',
      bookmarkRemoved: 'Bookmark removed.',
      addNotePlaceholder: 'Add a personal note (optional)...',
      saveBookmark: 'Save Bookmark',
      removeBookmark: 'Remove Bookmark',
      markLastRead: 'Mark as Last Read',
      lastReadSaved: 'Reading progress saved.',
      footnotes: 'Footnotes & Commentary',
      hideFootnotes: 'Hide Footnotes',
      noBookmarks: 'No bookmarked verses yet',
      noBookmarksDesc: 'Tap the bookmark icon on any verse to save it for quick return.',
      searchHint: 'Enter at least 2 characters to search across Quran verses.',
      noSearchResults: 'No verses matched your search.',
      attributionLabel: 'Somali Translation',
      sajdaLabel: 'Sajda',
    },
    adhkar: {
      title: 'Daily Adhkar',
      subtitle: 'Authentic remembrance with Arabic text, transliteration, Somali translation, and references.',
      allCategories: 'All Categories',
      favoritesOnly: 'Favorites',
      repeatGoal: 'Repeat Target',
      completed: 'Completed',
      tapToCount: 'Tap to count',
      resetCount: 'Reset',
      reference: 'Reference',
      virtue: 'Virtue',
      viewSource: 'View Source',
      noItemsInCategory: 'No Adhkar items are currently listed in this category.',
      noFavorites: 'You have not favorited any Adhkar items yet.',
      favoriteAdded: 'Added to favorites.',
      favoriteRemoved: 'Removed from favorites.',
    },
    tasbih: {
      title: 'Digital Tasbih',
      subtitle: 'Count your dhikr with custom targets and save sessions automatically.',
      selectCounter: 'Select Dhikr',
      newCounter: 'New Dhikr',
      counterTitlePlaceholder: 'e.g. SubhanAllah',
      arabicOptionalLabel: 'Arabic Text (Optional)',
      arabicPlaceholder: 'e.g. سُبْحَانَ اللَّهِ',
      targetLabel: 'Target Count',
      createCounter: 'Create Counter',
      tapToIncrement: 'Tap to count',
      currentRound: 'Current Count',
      totalCount: 'All-Time Total',
      saveSession: 'Save Session',
      sessionSaved: 'Tasbih session saved.',
      resetRound: 'Reset Count',
      historyTitle: 'Session History',
      noHistory: 'No saved Tasbih sessions yet.',
      noCounters: 'No Tasbih counters created yet.',
      loadPresets: 'Add Standard Presets',
      deleteCounter: 'Delete Counter',
      targetReached: 'Target reached',
    },
    account: {
      title: 'Preferences & Reminders',
      subtitle: 'Your progress, bookmarks, daily goals, and reminders are privately saved to your device session.',
      tabProfile: 'Preferences & Goal',
      tabReminders: 'Reminders',
      displayNameLabel: 'Name (Optional)',
      displayNamePlaceholder: 'Optional display name',
      profileSectionTitle: 'Personal Preferences',
      languageLabel: 'Interface Language',
      timezoneLabel: 'Timezone',
      useDeviceTimezone: 'Use Device Timezone',
      profileSaved: 'Preferences saved.',
      dailyGoalTitle: 'Daily Goal',
      dailyGoalDesc: 'Set your combined daily dhikr target for today.',
      dailyGoalSaved: 'Daily goal saved.',
      statsBookmarks: 'Bookmarked Verses',
      statsFavorites: 'Favorite Adhkar',
      statsTasbih: 'Tasbih Sessions',
      remindersTitle: 'Reminder Schedules',
      remindersHonestNote:
        'Reminder schedules are saved with timezone and weekday rules. Due reminders are highlighted in-app while NUUR is open.',
      addReminder: 'Add Reminder',
      reminderTypeLabel: 'Reminder Type',
      reminderTimeLabel: 'Time',
      weekdaysLabel: 'Days of Week',
      enabledLabel: 'Enabled',
      reminderSaved: 'Reminder saved.',
      reminderDeleted: 'Reminder deleted.',
      noRemindersYet: 'No reminders configured yet.',
      types: {
        morning: 'Morning Adhkar',
        evening: 'Evening Adhkar',
        quran: 'Quran Reading',
        custom: 'Custom Reminder',
      },
      appVersionLabel: 'Android App Version',
      contentSourcesTitle: 'Verified Content Sources',
    },
    offline: {
      offlineBadge: 'Offline Mode',
      onlineBadge: 'Online',
      pendingSync: 'pending sync',
      syncing: 'Syncing...',
      syncNow: 'Sync Now',
      syncError: 'Sync error',
      syncedSuccess: 'All queued progress synced.',
      cachedOfflineHint: 'Loaded from local device cache (offline).',
      cacheAllQuran: 'Save Quran for Offline',
      cachingQuran: 'Caching...',
      quranCachedCount: 'Surahs cached',
    },
    maintenance: {
      title: 'Scheduled Maintenance',
      defaultMessage: 'NUUR is temporarily closed for maintenance. Please check back shortly.',
      expectedEnd: 'Expected completion',
    },
    updates: {
      title: 'Android Update Available',
      mandatoryBadge: 'Mandatory Update',
      optionalBadge: 'New Release',
      currentVersion: 'Installed Version',
      latestVersion: 'Latest Release',
      minSupported: 'Minimum Supported',
      releaseNotes: 'Release Notes',
      downloadApk: 'Download APK (HTTPS)',
      noApkUrl: 'No verified HTTPS APK URL has been published for this release.',
      androidLimitationsTitle: 'Android APK Installation Notice',
      androidLimitationsBody:
        'Apps cannot silently install APK updates. After confirmation, your device browser will open the HTTPS link so you can download and approve the Android Package Installer prompt (and allow "Install unknown apps" if prompted by Android).',
      confirmDownload: 'Confirm & Open Download',
      upToDate: 'Your installed version is up to date.',
      checkUpdates: 'Check for Updates',
    },
    khatmah: {
      title: 'Khatmadda Qur’aanka',
      tabLabel: 'Khatmah',
      subtitle: 'Plan and track your complete Quran recitation day by day.',
      introTitle: 'Start a New Quran Khatmah',
      introBody:
        'Choose a 30, 60, or 90-day schedule across all 6,236 verses of the Holy Quran and track every completed daily portion.',
      startBtn: 'Bilow Khatmad',
      createTitle: 'Create Khatmah Plan',
      planNameLabel: 'Plan Name (Optional)',
      planNamePlaceholder: 'e.g. Monthly Quran Khatmah',
      durationLabel: 'Duration',
      daysUnit: 'days',
      versesPerDayApprox: 'verses/day avg',
      startDateLabel: 'Start Date',
      targetEndDateLabel: 'Target Completion Date',
      confirmCreate: 'Bilow Khatmad',
      creating: 'Creating...',
      activePlanExistsErr:
        'You already have an active Khatmah plan. Please resume or pause it before creating a new one.',
      planCreated: 'Khatmah plan started.',
      planPaused: 'Khatmah plan paused.',
      planResumed: 'Khatmah plan resumed.',
      planCompletedToast: 'MashaAllah! You completed the entire 6,236-verse Khatmah.',
      progressTitle: 'Horumarka Khatmadda',
      completedDaysLabel: 'Completed Days',
      remainingDaysLabel: 'Remaining Days',
      versesCompletedLabel: 'Verses Completed',
      todayPlanTitle: 'Qorshaha Maanta',
      continueReading: 'Sii wad Akhriska',
      markCompleted: 'Maanta waan dhammeeyey',
      confirmCompleteTitle: 'Confirm Daily Completion',
      confirmCompleteBody:
        'Confirm that you have completed reading the full verse range shown below.',
      confirmCompleteAction: 'Yes, Mark Completed',
      alreadyCompleted: 'This daily target is already completed.',
      completedSuccess: 'Alhamdulillah! Daily Khatmah reading recorded.',
      queuedOfflineSuccess:
        'Saved offline. Your completion will sync automatically when connectivity returns.',
      pauseBtn: 'Hakad geli',
      resumeBtn: 'Dib u bilow',
      pauseConfirmBody:
        'Pausing keeps all your recorded progress safe so you can resume anytime.',
      scheduleTitle: 'Daily Reading Schedule',
      plansTitle: 'Khatmah Plans',
      historyTitle: 'Reading History',
      filterAll: 'All',
      filterRemaining: 'Remaining',
      filterCompleted: 'Completed',
      dayPrefix: 'Day',
      versesCountUnit: 'verses',
      statusCompleted: 'Completed',
      statusCurrent: 'Current',
      statusUpcoming: 'Upcoming',
      statusActive: 'Active',
      statusPaused: 'Paused',
      statusDone: 'Completed',
      statusCancelled: 'Cancelled',
      noSchedule: 'No schedule found for this plan.',
      noPlans: 'No Khatmah plans created yet.',
      noHistory: 'No Khatmah reading logs recorded yet.',
      pausedNotice:
        'This plan is currently paused. Tap "Dib u bilow" to resume it.',
      completedBannerTitle: 'Khatmah Completed',
      completedBannerBody:
        'All 6,236 verses in this schedule have been completed. You can start a new Khatmah plan anytime.',
      queuedSyncNote: 'Pending offline sync',
      duplicateLogError: 'This reading range has already been logged.',
      homeCardCtaEmpty: 'Bilow Khatmad',
      homeCardEmptyDesc: 'Set a 30, 60, or 90-day Quran completion plan and track daily progress.',
      openTracker: 'Open Khatmah',
      allDaysDone: 'All scheduled days for this plan are completed.',
    },
  },
};

export const WEEKDAY_LABELS: Record<AppLang, string[]> = {
  so: ['Ax', 'Is', 'Ta', 'Ar', 'Kh', 'Ji', 'Sa'],
  en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
};

export function getTodayDateString(timezone?: string | null): string {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function getCurrentTimePartsInTimezone(timezone?: string | null): {
  weekday: number;
  minutesSinceMidnight: number;
  formattedTime: string;
} {
  try {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10) % 24;
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      weekday: map[weekdayStr] ?? now.getDay(),
      minutesSinceMidnight: hour * 60 + minute,
      formattedTime: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    };
  } catch {
    const now = new Date();
    return {
      weekday: now.getDay(),
      minutesSinceMidnight: now.getHours() * 60 + now.getMinutes(),
      formattedTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    };
  }
}
