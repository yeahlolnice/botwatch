// Maps schema.org JSON-LD @type values (already extracted by linkExtractor.js)
// to a human-readable category. Specific types are listed here; the generic
// LocalBusiness/Organization fallbacks are handled separately in
// categoryClassifier.js so a page tagged e.g. ["LocalBusiness", "Restaurant"]
// gets the specific "Food & Beverage" category, not the generic one.
export const TYPE_TO_CATEGORY = {
    // Food & Beverage
    Restaurant: 'Food & Beverage',
    CafeOrCoffeeShop: 'Food & Beverage',
    Bakery: 'Food & Beverage',
    BarOrPub: 'Food & Beverage',
    FoodEstablishment: 'Food & Beverage',
    Winery: 'Food & Beverage',
    Brewery: 'Food & Beverage',

    // Retail
    Store: 'Retail',
    ClothingStore: 'Retail',
    ElectronicsStore: 'Retail',
    GroceryStore: 'Retail',
    ShoppingCenter: 'Retail',
    JewelryStore: 'Retail',
    ShoeStore: 'Retail',
    SportingGoodsStore: 'Retail',
    HardwareStore: 'Retail',
    FurnitureStore: 'Retail',
    PetStore: 'Retail',
    BookStore: 'Retail',
    ConvenienceStore: 'Retail',
    DepartmentStore: 'Retail',

    // Healthcare
    MedicalBusiness: 'Healthcare',
    Physician: 'Healthcare',
    Hospital: 'Healthcare',
    Dentist: 'Healthcare',
    Pharmacy: 'Healthcare',
    VeterinaryCare: 'Healthcare',
    MedicalClinic: 'Healthcare',

    // Legal
    LegalService: 'Legal',
    Attorney: 'Legal',

    // Real Estate
    RealEstateAgent: 'Real Estate',

    // Finance
    FinancialService: 'Finance',
    BankOrCreditUnion: 'Finance',
    InsuranceAgency: 'Finance',
    AccountingService: 'Finance',

    // Education
    EducationalOrganization: 'Education',
    School: 'Education',
    CollegeOrUniversity: 'Education',
    Preschool: 'Education',

    // Technology
    SoftwareApplication: 'Technology/Software',
    WebApplication: 'Technology/Software',
    MobileApplication: 'Technology/Software',

    // Media
    NewsMediaOrganization: 'Media & News',

    // Nonprofit
    NGO: 'Nonprofit',
    NonprofitOrganization: 'Nonprofit',

    // Travel & Hospitality
    Hotel: 'Travel & Hospitality',
    LodgingBusiness: 'Travel & Hospitality',
    TravelAgency: 'Travel & Hospitality',
    Resort: 'Travel & Hospitality',
    Motel: 'Travel & Hospitality',

    // Automotive
    AutomotiveBusiness: 'Automotive',
    AutoDealer: 'Automotive',
    AutoRepair: 'Automotive',
    AutoRental: 'Automotive',

    // Beauty & Wellness
    BeautySalon: 'Beauty & Wellness',
    DaySpa: 'Beauty & Wellness',
    HairSalon: 'Beauty & Wellness',
    NailSalon: 'Beauty & Wellness',
    HealthClub: 'Beauty & Wellness',
    GymOrFitnessCenter: 'Beauty & Wellness',

    // Home Services
    HomeAndConstructionBusiness: 'Home Services',
    Electrician: 'Home Services',
    Plumber: 'Home Services',
    GeneralContractor: 'Home Services',
    HousePainter: 'Home Services',
    RoofingContractor: 'Home Services',
    MovingCompany: 'Home Services',

    // Entertainment
    MovieTheater: 'Entertainment',
    AmusementPark: 'Entertainment',
    NightClub: 'Entertainment',
    CasinoOrGamblingEstablishment: 'Entertainment',

    // Professional Services
    ProfessionalService: 'Professional Services',
};
