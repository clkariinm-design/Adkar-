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
