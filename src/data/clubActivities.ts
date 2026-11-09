export type ActivityCategory =
  | "all"
  | "anhbia"
  | "giaidau"
  | "giaoluu"
  | "cauthu"
  | "taitro";

export interface ClubActivityPost {
  id: string;
  category: "anhbia" | "giaidau" | "giaoluu" | "cauthu" | "taitro";
  categoryLabel: string;
  categoryBadgeClass: string;
  title: string;
  slug: string;
  summary: string;
  publishedDate: string;
  eventYear?: string; // Mốc năm / Mùa giải lưu trữ lâu dài (2026, 2025, 2024...)
  author: string;
  featuredImage: string;
  galleryImages?: string[];
  readingTime: string;
  paragraphs: string[];
  quote?: string;
  highlights?: string[];
  taggedPlayerNames?: string[]; // Danh sách cầu thủ gắn liền với bài viết / kỷ niệm
}

export const CLUB_TIMELINE_YEARS: Array<{
  id: string;
  label: string;
  highlight: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Toàn bộ kỷ niệm",
    highlight: "2024 - 2026+",
    description: "Biên niên sử hoạt động, hình ảnh và câu chuyện của FC HĐH Gò Nổi",
  },
  {
    id: "2026",
    label: "Mùa Giải 2026",
    highlight: "Chuyển Mình & Số Hóa",
    description: "Đồng bộ website chính thức, quy chuẩn áo đấu, mở rộng đội hình 23+ chiến binh",
  },
  {
    id: "2025",
    label: "Mùa Giải 2025",
    highlight: "Khẳng Định Bản Lĩnh",
    description: "Tham dự các giải phủi đồng hương Điện Bàn - Quảng Nam, thắt chặt nghĩa tình",
  },
  {
    id: "2024",
    label: "Khởi Nguồn 2024",
    highlight: "Gieo Mầm Kết Nối",
    description: "Những buổi gặp gỡ đầu tiên quy tụ con em 3 xã Điện Quang - Điện Trung - Điện Phong",
  },
];

export const ACTIVITY_CATEGORIES: Array<{
  id: ActivityCategory;
  label: string;
  iconName: string;
  description: string;
}> = [
  {
    id: "all",
    label: "Tất cả hoạt động",
    iconName: "Flame",
    description: "Toàn bộ tin tức, giải đấu, giao lưu và khoảnh khắc của FC HĐH Gò Nổi",
  },
  {
    id: "giaidau",
    label: "Giải Đấu & Phong Trào",
    iconName: "Trophy",
    description: "Những trận cầu nảy lửa, tinh thần chiến đấu hết mình tại các giải phủi đồng hương",
  },
  {
    id: "giaoluu",
    label: "Giao Lưu Kết Nối",
    iconName: "HeartHandshake",
    description: "Những trận giao hữu thân mật, thắt chặt nghĩa tình với các đội bạn và hội đồng hương",
  },
  {
    id: "cauthu",
    label: "Cầu Thủ Gò Nổi",
    iconName: "Users",
    description: "Gương mặt, câu chuyện và những khoảnh khắc tỏa sáng của 23+ chiến binh sân cỏ",
  },
  {
    id: "taitro",
    label: "Đồng Hành & Tài Trợ",
    iconName: "Award",
    description: "Tri ân các mạnh thường quân, doanh nhân quê hương tiếp sức cho đội bóng",
  },
  {
    id: "anhbia",
    label: "Ảnh Bìa & Khí Thế",
    iconName: "Camera",
    description: "Những khung hình tập thể trang trọng, đại diện cho bản sắc và tinh thần FC Gò Nổi",
  },
];

export const CLUB_ACTIVITIES_POSTS: ClubActivityPost[] = [
  {
    id: "post-gd-1",
    category: "giaidau",
    categoryLabel: "Giải Đấu & Phong Trào",
    categoryBadgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "Rực lửa sân 7 Sài Gòn: Hành trình quả cảm của FC HĐH Gò Nổi tại giải bóng đá đồng hương",
    slug: "hanh-trinh-giai-dau-phong-trao-go-noi",
    publishedDate: "2026-10-25",
    eventYear: "2026",
    author: "Ban Truyền Thông FC Gò Nổi",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/DSC06522.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaidau/DSC06290.webp",
      "/images/hinhanh-webp/giaidau/DSC06526.webp",
      "/images/hinhanh-webp/giaidau/DSC06530.webp",
      "/images/hinhanh-webp/giaidau/DSC06730.webp",
      "/images/hinhanh-webp/giaidau/DSC06735.webp",
      "/images/hinhanh-webp/giaidau/DSC06751.webp",
    ],
    summary:
      "Dưới ánh đèn rực rỡ của các sân cỏ nhân tạo TP.HCM, những bước chạy thanh thoát và lối đá máu lửa của anh em Gò Nổi đã tạo nên những trận cầu nghẹt thở, cống hiến trọn vẹn cho người hâm mộ quê nhà.",
    paragraphs: [
      "Bước vào mỗi giải đấu phong trào, FC HĐH Gò Nổi luôn mang trong mình niềm tự hào đại diện cho mảnh đất ba xã Điện Quang, Điện Trung, Điện Phong. Không chỉ là sự so tài về kỹ chiến thuật trên mặt cỏ nhân tạo, mỗi trận đấu là dịp để anh em khẳng định bản lĩnh kiên cường, sự bền bỉ của người con xứ Quảng xa quê.",
      "Ở từng pha bóng tranh chấp quyết liệt từ giữa sân cho đến những pha phản công thần tốc bên cánh, các cầu thủ luôn thi đấu với hơn 100% sức lực. Dưới sự chỉ đạo nhịp nhàng của Đội trưởng Thế Tiếng cùng sự chắc chắn của hàng thủ do Đội phó Viết Tín chỉ huy, đội bóng đã thể hiện lối chơi gắn kết, tôn trọng đối thủ và cống hiến những pha phối hợp đẹp mắt.",
      "Tiếng reo hò từ đường biên của các cổ động viên đồng hương là nguồn động lực to lớn giúp các cầu thủ vượt qua những thời khắc căng thẳng nhất. Dù thắng hay hòa, điều đọng lại sâu sắc nhất vẫn là tinh thần fair-play, nụ cười rạng rỡ và sự tự hào khi cùng khoác lên mình màu áo quê hương.",
    ],
    quote: "Đá phủi bằng cả trái tim, thắng không kiêu, bại không nản — quan trọng nhất là tinh thần Gò Nổi luôn rực sáng!",
    highlights: [
      "Lối đá ban bật ngắn, gắn kết và giàu năng lượng",
      "Sự kết hợp ăn ý giữa thế hệ dạn dày kinh nghiệm và các nhân tố trẻ",
      "Sự cổ vũ nồng nhiệt của bà con đồng hương Gò Nổi tại TP.HCM",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Hồ Viết Tín", "Lê Anh Trung", "Vũ Hùng Khương", "Nguyễn Văn Thịnh"],
  },
  {
    id: "post-gd-3",
    category: "giaidau",
    categoryLabel: "Giải Đấu & Phong Trào",
    categoryBadgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "Phóng sự ảnh: 90 phút quả cảm và những giọt mồ hôi tự hào trên thảm cỏ Sài Gòn",
    slug: "phong-su-anh-90-phut-qua-cam",
    publishedDate: "2026-10-21",
    eventYear: "2026",
    author: "Nhiếp ảnh gia CLB",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/DSC06361.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaidau/DSC06297.webp",
      "/images/hinhanh-webp/giaidau/DSC06300.webp",
      "/images/hinhanh-webp/giaidau/DSC06524.webp",
      "/images/hinhanh-webp/giaidau/DSC06527.webp",
      "/images/hinhanh-webp/giaidau/DSC06534.webp",
      "/images/hinhanh-webp/giaidau/DSC06732.webp",
      "/images/hinhanh-webp/giaidau/DSC06750.webp",
    ],
    summary:
      "Từng khoảnh khắc cản phá xuất thần, những pha bứt tốc bên đường biên và những nụ cười tỏa nắng sau tiếng còi mãn cuộc — tất cả được ghi lại trọn vẹn trong bộ phóng sự ảnh đặc biệt này.",
    paragraphs: [
      "Bộ ảnh được chụp trực tiếp tại các trận cầu tâm điểm của FC HĐH Gò Nổi, lưu giữ chân thực từng biểu cảm giàu cảm xúc: từ sự tập trung cao độ trước giờ bóng lăn, sự quyết liệt trong từng pha vào bóng đúng luật, đến khoảnh khắc ôm chặt lấy nhau sau khi cứu thua thành công.",
      "Đối với anh em con em đất Quảng tại TP.HCM, những bức ảnh này là tài sản tinh thần vô giá, là nơi ghi dấu tuổi thanh xuân rực rỡ bên trái bóng tròn và những người anh em chí cốt một nhà.",
    ],
    quote: "Mỗi giọt mồ hôi rơi trên mặt sân cỏ hôm nay là một kỷ niệm đẹp đồng hành cùng năm tháng.",
    highlights: [
      "Bộ sưu tập ảnh độ phân giải cao ghi lại chân thực từng nhịp đập trận đấu",
      "Tôn vinh tinh thần thi đấu quả cảm của toàn thể đội hình",
    ],
    taggedPlayerNames: ["Lại Văn Toàn", "Nguyễn Đăng Xuân", "Ngô Công Phát", "Trần Xuân Minh"],
  },
  {
    id: "post-gd-2",
    category: "giaidau",
    categoryLabel: "Giải Đấu & Phong Trào",
    categoryBadgeClass: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    title: "Khoảnh khắc vỡ òa: Niềm vui ghi bàn và tinh thần ăn mừng bất diệt",
    slug: "khoanh-khac-vo-oa-ban-thang",
    publishedDate: "2026-10-18",
    eventYear: "2026",
    author: "BQL Đội bóng",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/DSC06530.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaidau/DSC06535.webp",
      "/images/hinhanh-webp/giaidau/DSC06553.webp",
      "/images/hinhanh-webp/giaidau/DSC06751.webp",
      "/images/hinhanh-webp/giaidau/DSC06528.webp",
    ],
    summary:
      "Một cú vung chân quyết đoán đưa bóng găm thẳng vào góc lưới, và rồi tất cả ôm chầm lấy nhau trong niềm hạnh phúc tột cùng. Đó là khoảnh khắc kỳ diệu chỉ bóng đá mới có thể đem lại.",
    paragraphs: [
      "Bàn thắng trong bóng đá phủi không chỉ mang về điểm số, mà nó là sự kết tinh của hàng chục pha chuyền bóng, của những giọt mồ hôi rơi sau những giờ làm việc mệt nhọc trong tuần. Khi lưới đối phương rung lên, mọi lo toan thường nhật dường như tan biến.",
      "Những cái ôm siết chặt, những nụ cười tỏa nắng trên khuôn mặt thấm đẫm mồ hôi đã minh chứng cho tình đồng đội keo sơn. Tại FC HĐH Gò Nổi, người ghi bàn là niềm vui chung của toàn đội, và người kiến tạo cũng được tôn vinh xứng đáng.",
    ],
    quote: "Bóng đá đẹp nhất khi đồng đội cùng chia sẻ niềm vui chiến thắng và dìu nhau đứng dậy sau những pha bóng khó.",
    highlights: [
      "Những siêu phẩm sút xa và phối hợp nhóm nhuần nhuyễn",
      "Tinh thần sẻ chia niềm vui, gắn kết anh em trên sân",
    ],
    taggedPlayerNames: ["Lê Anh Trung", "Nguyễn Thanh Vĩnh", "Phan Phước Trường"],
  },
  {
    id: "post-gl-1",
    category: "giaoluu",
    categoryLabel: "Giao Lưu Kết Nối",
    categoryBadgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    title: "Giao lưu nghĩa tình: Kết nối bền chặt giữa FC Gò Nổi và các CLB đồng hương tại TP.HCM",
    slug: "giao-luu-ket-noi-dong-huong-tp-hcm",
    publishedDate: "2026-10-22",
    eventYear: "2026",
    author: "Đội phó Hồ Viết Tín",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaoluu/2a0ee93bb4f234ac6de32.webp",
      "/images/hinhanh-webp/giaoluu/30a151040ccd8c93d5dc8.webp",
      "/images/hinhanh-webp/giaoluu/f799b42fe9e669b830f79.webp",
    ],
    summary:
      "Những buổi giao hữu cuối tuần không chỉ rèn luyện sức khỏe mà còn là cơ hội quý báu để mở rộng mạng lưới giao lưu, hỗ trợ nhau trong cuộc sống và công việc tại thành phố mang tên Bác.",
    paragraphs: [
      "Bên cạnh các giải đấu chính thức, FC HĐH Gò Nổi thường xuyên tổ chức các trận đấu giao hữu cọ xát với các đội bóng đồng hương Điện Bàn, Duy Xuyên, Đại Lộc và các câu lạc bộ doanh nghiệp trẻ tại TP.HCM.",
      "Trước trận đấu, anh em bắt tay chào hỏi nồng hậu; trong trận đấu thì so tài quyết liệt nhưng mẫu mực; sau trận đấu lại quây quần bên nhau chia sẻ những câu chuyện về quê hương, về những dự định phát triển nghề nghiệp và kết nối các cơ hội hợp tác kinh doanh.",
      "Đây chính là giá trị cốt lõi mà Ban Điều Hành đội bóng luôn hướng tới: thể thao làm cầu nối gắn kết tình đồng hương, biến sân bóng thành điểm tựa tinh thần ấm áp cho những người con xa xứ.",
    ],
    quote: "Ra sân là đối thủ trên từng đường bóng, rời sân là anh em chí cốt một nhà!",
    highlights: [
      "Kết nối thường xuyên với các hội đồng hương bạn tại TP.HCM",
      "Mở rộng giao lưu văn hóa, thể thao và hợp tác công việc",
    ],
    taggedPlayerNames: ["Hồ Viết Tín", "Dương Hiển Hoài Sơn", "Nguyễn Văn Dũng"],
  },
  {
    id: "post-gl-2",
    category: "giaoluu",
    categoryLabel: "Giao Lưu Kết Nối",
    categoryBadgeClass: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    title: "Nhật ký sân Vĩnh Lộc: Nơi rèn thể lực, sẻ chia công việc và gắn kết tình anh em xa quê",
    slug: "nhat-ky-san-vinh-loc-sinh-hoat-tuan",
    publishedDate: "2025-11-15",
    eventYear: "2025",
    author: "Ban Quản Lý Đội",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/giaidau/1c025d36688be9d5b09a18.webp",
    galleryImages: [
      "/images/hinhanh-webp/giaoluu/30a151040ccd8c93d5dc8.webp",
      "/images/hinhanh-webp/giaidau/DSC06301.webp",
      "/images/hinhanh-webp/giaidau/DSC06363.webp",
    ],
    summary:
      "Cứ đều đặn mỗi tối thứ Bảy hoặc Chủ Nhật, Sân Vĩnh Lộc lại rộn vang tiếng cười, tiếng reo hò bằng chất giọng Quảng Nam đặc trưng không thể lẫn vào đâu được.",
    paragraphs: [
      "Đối với anh em FC HĐH Gò Nổi, buổi đá bóng hàng tuần không đơn thuần là 90 phút chạy theo trái bóng, mà là khoảng thời gian được 'trở về nhà'. Giữa bộn bề áp lực cơm áo gạo tiền nơi đất khách, sân bóng là nơi mọi người gác lại lo âu để thỏa sức cười đùa, giải tỏa căng thẳng.",
      "Sau tiếng còi mãn cuộc, những ly trà đá, những cốc bia giải khát bên lề sân lại là dịp để anh em hàn huyên, giới thiệu việc làm cho các bạn sinh viên mới ra trường và cùng nhau bàn thảo kế hoạch hỗ trợ bà con quê nhà trong các dịp bão lũ hay Tết đến xuân về.",
    ],
    quote: "Sân bóng là mái nhà thứ hai, nơi anh em tìm thấy hơi ấm quê hương giữa lòng thành phố lớn.",
    highlights: [
      "Duy trì đều đặn lịch sinh hoạt tuần qua nhiều năm",
      "Môi trường giao lưu lành mạnh, hỗ trợ nhau cả trong đời sống thực tế",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Võ Quang Quốc", "Nguyễn Văn Hải"],
  },
  {
    id: "post-ct-1",
    category: "cauthu",
    categoryLabel: "Cầu Thủ Gò Nổi",
    categoryBadgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    title: "23+ Chiến binh Gò Nổi: Tinh thần nhiệt huyết, sức trẻ và bản lĩnh sân cỏ",
    slug: "23-chien-binh-go-noi-tinh-than-nhiet-huyet",
    publishedDate: "2026-10-20",
    eventYear: "2026",
    author: "Ban Quản Lý Đội",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/cauthu/05f39aceaf732e2d776225.webp",
    galleryImages: [
      "/images/hinhanh-webp/cauthu/53bf36c3037e8220db6f.webp",
      "/images/hinhanh-webp/cauthu/671f762b4396c2c89b871.webp",
      "/images/hinhanh-webp/cauthu/9eb2c38ff632776c2e2322.webp",
      "/images/hinhanh-webp/cauthu/420f523b6786e6d8bf973.webp",
      "/images/hinhanh-webp/cauthu/b963f9c808d1888fd1c0.webp",
      "/images/hinhanh-webp/cauthu/c44a8e77bbca3a9463db32.webp",
    ],
    summary:
      "Mỗi cầu thủ là một câu chuyện riêng về tình yêu bóng đá và lòng hướng về cội nguồn. Từ anh em sinh viên cho đến các kỹ sư, nhân viên văn phòng, tất cả cùng chung nhịp đập khi xỏ giày ra sân.",
    paragraphs: [
      "Đội hình hiện tại của FC HĐH Gò Nổi quy tụ hơn 23 thành viên nòng cốt và đang tiếp tục kết nạp thêm nhiều nhân tố mới. Điều đặc biệt là mỗi cầu thủ đều sở hữu một thẻ Profile cá nhân 3D trên hệ thống website, nơi anh em có thể tự do viết lời giới thiệu, thể hiện phong cách thi đấu và phương châm sống của mình.",
      "Từ vị trí thủ môn kiên cường, các hậu vệ lăn xả cản phá, những tiền vệ điều phối nhịp nhàng đến các tiền đạo chớp thời cơ nhạy bén — mỗi cá nhân đều là một mảnh ghép không thể thiếu tạo nên sức mạnh đoàn kết của đội bóng.",
      "Dù công việc thường ngày có bận rộn đến đâu, cứ đến tối thứ Bảy hay sáng Chủ Nhật, anh em lại cùng nhau ra sân với nụ cười sảng khoái và tinh thần tràn đầy năng lượng tích cực.",
    ],
    quote: "Không quan trọng bạn đá ở vị trí nào, chỉ cần bạn mang trong mình tinh thần Gò Nổi — bạn là một phần của chiến thắng!",
    highlights: [
      "Đội hình 23+ cầu thủ đa dạng độ tuổi, giàu nhiệt huyết",
      "Tính năng Profile cá nhân tự sửa độc đáo trên website",
      "Chào đón tất cả anh em đồng hương muốn gia nhập",
    ],
    taggedPlayerNames: ["Lê Anh Trung", "Nguyễn Thế Tiếng", "Hồ Viết Tín", "Nguyễn Văn Dũng", "Nguyễn Văn Thịnh"],
  },
  {
    id: "post-ct-2",
    category: "cauthu",
    categoryLabel: "Cầu Thủ Gò Nổi",
    categoryBadgeClass: "bg-sky-500/20 text-sky-300 border-sky-500/40",
    title: "Những người giữ lửa thầm lặng: Tôn vinh Ban Cán Sự & hậu phương vững vàng của FC Gò Nổi",
    slug: "nhung-nguoi-giu-lua-tham-lang-bql",
    publishedDate: "2025-12-08",
    eventYear: "2025",
    author: "Tập thể Cầu thủ FC Gò Nổi",
    readingTime: "4 phút đọc",
    featuredImage: "/images/hinhanh-webp/cauthu/edacc691f32c72722b3d19.webp",
    galleryImages: [
      "/images/hinhanh-webp/cauthu/ebc40a5f3fe2bebce7f36.webp",
      "/images/hinhanh-webp/cauthu/fcbf6282573fd6618f2e28.webp",
      "/images/hinhanh-webp/cauthu/e764ca21ff9c7ec2278d38.webp",
    ],
    summary:
      "Đằng sau mỗi trận cầu suôn sẻ là sự hy sinh thầm lặng của Ban Cán Sự: từ việc đặt sân, thu chi minh bạch từng đồng quỹ đến chuẩn bị nước uống, áo đấu chu đáo cho toàn đội.",
    paragraphs: [
      "Để một đội bóng phong trào duy trì bền bỉ qua nhiều năm tháng, tâm huyết của những người thủ lĩnh là yếu tố sống còn. Đội trưởng Nguyễn Thế Tiếng không chỉ là trụ cột trên sân mà còn kiêm nhiệm thủ quỹ, ghi chép sổ sách thu chi rõ ràng tới từng con số.",
      "Bên cạnh đó, Đội phó Hồ Viết Tín cùng anh Dương Hiển Hoài Sơn và Vương Lâm luôn là những người đến sân sớm nhất và ra về muộn nhất, kiểm tra trang thiết bị và lo toan mọi công việc hậu cần để anh em yên tâm cống hiến hết mình.",
    ],
    quote: "Sự nhiệt tâm của Ban Cán Sự chính là điểm tựa vững chãi nhất để ngọn lửa FC Gò Nổi luôn rực cháy.",
    highlights: [
      "Sự cống hiến thầm lặng vì tập thể không quản ngại khó khăn",
      "Minh bạch tài chính 100% xây dựng niềm tin bền vững",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Hồ Viết Tín", "Dương Hiển Hoài Sơn", "Vũ Hùng Khương"],
  },
  {
    id: "post-tt-1",
    category: "taitro",
    categoryLabel: "Đồng Hành & Tài Trợ",
    categoryBadgeClass: "bg-rose-500/20 text-rose-300 border-rose-500/40",
    title: "Tri ân những tấm lòng vàng: Tiếp sức cho ngọn lửa bóng đá FC HĐH Gò Nổi",
    slug: "tri-an-nha-tai-tro-tiep-suc-doi-bong",
    publishedDate: "2026-10-15",
    eventYear: "2026",
    author: "Đội trưởng Nguyễn Thế Tiếng",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/taitro/16a77ea82361a33ffa703.webp",
    galleryImages: [
      "/images/hinhanh-webp/taitro/d120b134ecfd6ca335ec4.webp",
      "/images/hinhanh-webp/anhbia/IMG_5575.webp",
    ],
    summary:
      "Sự đồng hành của các doanh nghiệp, mạnh thường quân và các thế hệ anh em đi trước là nguồn động viên vô giá giúp đội bóng duy trì sân chơi thể thao chất lượng và bền vững.",
    paragraphs: [
      "Để FC HĐH Gò Nổi duy trì hoạt động bài bản và tham gia đều đặn các giải đấu phong trào, sự chung tay tiếp sức từ các nhà tài trợ và mạnh thường quân có ý nghĩa đặc biệt to lớn.",
      "Từ những bộ áo đấu rực rỡ mang biểu tượng quê hương, kinh phí thuê sân bãi tập luyện, đến những phần quà khích lệ tinh thần sau mỗi trận thắng — tất cả đều thể hiện sự quan tâm sâu sắc của cộng đồng người Gò Nổi đối với thế hệ trẻ.",
      "Ban Điều Hành đội bóng xin gửi lời tri ân chân thành nhất tới quý nhà tài trợ, các anh chị đồng hương đã luôn dõi theo và đồng hành. Đội cam kết sử dụng mọi nguồn tài trợ một cách minh bạch, hiệu quả và luôn thi đấu hết mình vì danh dự màu cờ sắc áo Gò Nổi.",
    ],
    quote: "Mỗi sự ủng hộ, đồng hành là một viên gạch xây đắp nên mái nhà chung ấm áp nghĩa tình quê hương.",
    highlights: [
      "Tri ân các nhà tài trợ trang phục thi đấu và quỹ đội",
      "Minh bạch tài chính 100% công khai trên cổng thông tin",
      "Mời gọi các doanh nghiệp đồng hương tiếp tục đồng hành",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Hồ Viết Tín"],
  },
  {
    id: "post-ab-1",
    category: "anhbia",
    categoryLabel: "Ảnh Bìa & Khí Thế",
    categoryBadgeClass: "bg-indigo-500/20 text-indigo-300 border-indigo-500/40",
    title: "Bức ảnh đại diện: Dấu ấn tập thể kiên trung và khát vọng vươn xa",
    slug: "buc-anh-dai-dien-khi-the-fc-go-noi",
    publishedDate: "2026-10-10",
    eventYear: "2026",
    author: "Ban Truyền Thông FC Gò Nổi",
    readingTime: "3 phút đọc",
    featuredImage: "/images/hinhanh-webp/anhbia/DSC06734.webp",
    galleryImages: [
      "/images/hinhanh-webp/anhbia/IMG_5574.webp",
      "/images/hinhanh-webp/anhbia/IMG_5575.webp",
      "/images/hinhanh-webp/anhbia/IMG_5576.webp",
      "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
    ],
    summary:
      "Khoảnh khắc toàn đội cùng khoác vai nhau đứng dưới ánh mặt trời rực rỡ, ánh mắt rạng ngời niềm tin và khí thế chuẩn bị cho một chặng đường phát triển mới.",
    paragraphs: [
      "Bức ảnh bìa chính thức của đội bóng được chụp vào một buổi chiều thi đấu rực nắng tại sân bóng TP.HCM. Từng nụ cười, từng dáng đứng hiên ngang trong bộ áo đấu vàng - xanh sapphire đã tạo nên một hình ảnh đầy cảm xúc về sự đoàn kết.",
      "Đó không đơn thuần là một tấm ảnh kỷ niệm, mà là lời khẳng định về một tập thể đồng hương gắn bó, vững vàng trước mọi thử thách và luôn sẵn lòng dang rộng vòng tay đón nhận bất kỳ người con Gò Nổi nào gia nhập.",
    ],
    quote: "Một người vì mọi người, mọi người vì màu cờ sắc áo Gò Nổi!",
    highlights: [
      "Hình ảnh nhận diện chính thức trên toàn bộ cổng thông tin",
      "Biểu tượng của sự gắn kết và tinh thần bất khuất quê hương",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Hồ Viết Tín", "Lê Anh Trung", "Vũ Hùng Khương", "Dương Hiển Hoài Sơn"],
  },
  {
    id: "post-kn-1",
    category: "anhbia",
    categoryLabel: "Khởi Nguồn & Kỷ Niệm",
    categoryBadgeClass: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    title: "Khởi nguồn Gò Nổi: Ba xã Điện Quang - Điện Trung - Điện Phong chung một mái nhà nghĩa tình",
    slug: "khoi-nguon-fc-hdh-go-noi",
    publishedDate: "2024-06-18",
    eventYear: "2024",
    author: "Người sáng lập FC Gò Nổi",
    readingTime: "5 phút đọc",
    featuredImage: "/images/hinhanh-webp/anhbia/673ca5fcf835786b21245.webp",
    galleryImages: [
      "/images/hinhanh-webp/anhbia/DSC06734.webp",
      "/images/hinhanh-webp/giaoluu/29c7f1c6ac0f2c51751e1.webp",
      "/images/hinhanh-webp/taitro/16a77ea82361a33ffa703.webp",
    ],
    summary:
      "Sinh ra từ mảnh đất bãi bồi trù phú được bao bọc bởi hai nhánh sông Thu Bồn, những người con Gò Nổi xa quê đã cùng nhau dựng xây nên một mái nhà thể thao tràn đầy nghĩa tình tại phương Nam.",
    paragraphs: [
      "Vùng đất Gò Nổi gồm ba xã Điện Quang, Điện Trung, Điện Phong vốn nức tiếng hiếu học, kiên cường và giàu truyền thống cách mạng. Rời quê hương vào TP.HCM lập nghiệp, mỗi người mang một số phận, một công việc khác nhau, nhưng trong tim ai cũng đau đáu nỗi nhớ quê.",
      "Ý tưởng thành lập đội bóng nảy sinh từ một buổi gặp mặt thân mật của một nhóm anh em yêu thể thao vào giữa năm 2024. Với mong muốn tạo ra một không gian sinh hoạt văn hóa, rèn luyện sức khỏe và tương trợ lẫn nhau, FC HĐH Gò Nổi chính thức ra đời.",
      "Từ những ngày đầu gom góp từng chiếc áo tập, tìm kiếm từng cụm sân bóng, đến nay đội đã phát triển thành một tập thể vững mạnh với hơn 23 cầu thủ nòng cốt, nhận được sự đồng hành to lớn của Hội đồng hương và các mạnh thường quân quê nhà. Đây chính là minh chứng sống động cho câu ca: 'Người Gò Nổi đi đâu cũng tìm về với nhau'.",
    ],
    quote: "Dù đi trăm nẻo bốn phương, hồn quê Gò Nổi vẫn vẹn nguyên trong từng bước chạy.",
    highlights: [
      "Mốc son thành lập kết nối cộng đồng người Gò Nổi tại TP.HCM",
      "Lan tỏa giá trị văn hóa và nghĩa tình quê hương bền chặt",
    ],
    taggedPlayerNames: ["Nguyễn Thế Tiếng", "Hồ Viết Tín", "Nguyễn Văn Dũng", "Trần Xuân Minh"],
  },
];
