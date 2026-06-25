package ilink

import "encoding/json"

// Message types
const (
	MessageTypeNone = 0
	MessageTypeUser = 1
	MessageTypeBot  = 2
)

// Message states
const (
	MessageStateNew        = 0
	MessageStateGenerating = 1
	MessageStateFinish     = 2
)

// Item types
const (
	ItemTypeNone  = 0
	ItemTypeText  = 1
	ItemTypeImage = 2
	ItemTypeVoice = 3
	ItemTypeFile  = 4
	ItemTypeVideo = 5
)

// QRCodeResponse is the response from get_bot_qrcode.
type QRCodeResponse struct {
	QRCode           string `json:"qrcode"`
	QRCodeImgContent string `json:"qrcode_img_content"`
}

// QRStatusResponse is the response from get_qrcode_status.
type QRStatusResponse struct {
	Status      string `json:"status"`
	BotToken    string `json:"bot_token"`
	ILinkBotID  string `json:"ilink_bot_id"`
	BaseURL     string `json:"baseurl"`
	ILinkUserID string `json:"ilink_user_id"`
}

// Credentials stores login session data.
type Credentials struct {
	BotToken    string `json:"bot_token"`
	ILinkBotID  string `json:"ilink_bot_id"`
	BaseURL     string `json:"baseurl"`
	ILinkUserID string `json:"ilink_user_id"`
}

// BaseInfo is included in request bodies.
type BaseInfo struct {
	ChannelVersion string `json:"channel_version,omitempty"`
}

// GetUpdatesRequest is the body for getupdates.
type GetUpdatesRequest struct {
	GetUpdatesBuf string   `json:"get_updates_buf"`
	BaseInfo      BaseInfo `json:"base_info"`
}

// GetUpdatesResponse is the response from getupdates.
type GetUpdatesResponse struct {
	Ret                  int             `json:"ret"`
	ErrCode              int             `json:"errcode,omitempty"`
	ErrMsg               string          `json:"errmsg,omitempty"`
	Msgs                 []WeixinMessage `json:"msgs"`
	GetUpdatesBuf        string          `json:"get_updates_buf"`
	LongPollingTimeoutMs int             `json:"longpolling_timeout_ms,omitempty"`
}

// WeixinMessage represents a message from WeChat.
type WeixinMessage struct {
	Seq          int             `json:"seq,omitempty"`
	MessageID    int64           `json:"message_id,omitempty"`
	FromUserID   string          `json:"from_user_id"`
	ToUserID     string          `json:"to_user_id"`
	MessageType  int             `json:"message_type"`
	MessageState int             `json:"message_state"`
	ItemList     []MessageItem   `json:"item_list"`
	ContextToken string          `json:"context_token"`
	Raw          json.RawMessage `json:"-"`
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase payloads.
func (m *WeixinMessage) UnmarshalJSON(data []byte) error {
	type alias WeixinMessage
	var decoded struct {
		alias
		MessageIDAlt    int64         `json:"messageId"`
		FromUserIDAlt   string        `json:"fromUserId"`
		ToUserIDAlt     string        `json:"toUserId"`
		MessageTypeAlt  int           `json:"messageType"`
		MessageStateAlt int           `json:"messageState"`
		ItemListAlt     []MessageItem `json:"itemList"`
		ContextTokenAlt string        `json:"contextToken"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*m = WeixinMessage(decoded.alias)
	if m.MessageID == 0 {
		m.MessageID = decoded.MessageIDAlt
	}
	if m.FromUserID == "" {
		m.FromUserID = decoded.FromUserIDAlt
	}
	if m.ToUserID == "" {
		m.ToUserID = decoded.ToUserIDAlt
	}
	if m.MessageType == 0 {
		m.MessageType = decoded.MessageTypeAlt
	}
	if m.MessageState == 0 {
		m.MessageState = decoded.MessageStateAlt
	}
	if len(m.ItemList) == 0 {
		m.ItemList = decoded.ItemListAlt
	}
	if m.ContextToken == "" {
		m.ContextToken = decoded.ContextTokenAlt
	}
	m.Raw = append(m.Raw[:0], data...)
	return nil
}

// MessageItem is a single item in a message.
type MessageItem struct {
	Type      int             `json:"type"`
	TextItem  *TextItem       `json:"text_item,omitempty"`
	ImageItem *ImageItem      `json:"image_item,omitempty"`
	VoiceItem *VoiceItem      `json:"voice_item,omitempty"`
	VideoItem *VideoItem      `json:"video_item,omitempty"`
	FileItem  *FileItem       `json:"file_item,omitempty"`
	Raw       json.RawMessage `json:"-"`
}

// UnmarshalJSON preserves unknown payload fields for quote/reference handling.
func (m *MessageItem) UnmarshalJSON(data []byte) error {
	type alias MessageItem
	var decoded struct {
		alias
		TextItemAlt  *TextItem  `json:"textItem"`
		ImageItemAlt *ImageItem `json:"imageItem"`
		VoiceItemAlt *VoiceItem `json:"voiceItem"`
		VideoItemAlt *VideoItem `json:"videoItem"`
		FileItemAlt  *FileItem  `json:"fileItem"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*m = MessageItem(decoded.alias)
	if m.TextItem == nil {
		m.TextItem = decoded.TextItemAlt
	}
	if m.ImageItem == nil {
		m.ImageItem = decoded.ImageItemAlt
	}
	if m.VoiceItem == nil {
		m.VoiceItem = decoded.VoiceItemAlt
	}
	if m.VideoItem == nil {
		m.VideoItem = decoded.VideoItemAlt
	}
	if m.FileItem == nil {
		m.FileItem = decoded.FileItemAlt
	}
	m.Raw = append(m.Raw[:0], data...)
	return nil
}

// CDN media type constants.
const (
	CDNMediaTypeImage = 1
	CDNMediaTypeVideo = 2
	CDNMediaTypeFile  = 3
)

// GetUploadURLRequest is the body for getuploadurl.
type GetUploadURLRequest struct {
	FileKey     string   `json:"filekey"`
	MediaType   int      `json:"media_type"`
	ToUserID    string   `json:"to_user_id"`
	RawSize     int      `json:"rawsize"`
	RawFileMD5  string   `json:"rawfilemd5"`
	FileSize    int      `json:"filesize"`
	NoNeedThumb bool     `json:"no_need_thumb"`
	AESKey      string   `json:"aeskey"`
	BaseInfo    BaseInfo `json:"base_info"`
}

// GetUploadURLResponse is the response from getuploadurl.
type GetUploadURLResponse struct {
	Ret           int    `json:"ret"`
	ErrMsg        string `json:"errmsg,omitempty"`
	UploadParam   string `json:"upload_param"`
	UploadFullURL string `json:"upload_full_url,omitempty"`
}

// TextItem holds text content.
type TextItem struct {
	Text string `json:"text"`
}

// MediaInfo holds CDN media reference for uploaded files.
type MediaInfo struct {
	EncryptQueryParam string `json:"encrypt_query_param"`
	AESKey            string `json:"aes_key"`      // base64-encoded
	EncryptType       int    `json:"encrypt_type"` // 1 = AES-128-ECB
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase media fields.
func (m *MediaInfo) UnmarshalJSON(data []byte) error {
	var decoded struct {
		EncryptQueryParam      string `json:"encrypt_query_param"`
		EncryptQueryParamCamel string `json:"encryptQueryParam"`
		AESKey                 string `json:"aes_key"`
		AESKeyCamel            string `json:"aesKey"`
		EncryptType            int    `json:"encrypt_type"`
		EncryptTypeCamel       int    `json:"encryptType"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	m.EncryptQueryParam = firstNonEmpty(decoded.EncryptQueryParam, decoded.EncryptQueryParamCamel)
	m.AESKey = firstNonEmpty(decoded.AESKey, decoded.AESKeyCamel)
	m.EncryptType = firstNonZero(decoded.EncryptType, decoded.EncryptTypeCamel)
	return nil
}

// VoiceItem holds voice content.
type VoiceItem struct {
	Media         *MediaInfo `json:"media,omitempty"`
	VoiceSize     int        `json:"voice_size,omitempty"`
	EncodeType    int        `json:"encode_type,omitempty"` // 1=pcm 2=adpcm 3=feature 4=speex 5=amr 6=silk 7=mp3
	BitsPerSample int        `json:"bits_per_sample,omitempty"`
	SampleRate    int        `json:"sample_rate,omitempty"` // Hz
	Playtime      int        `json:"playtime,omitempty"`    // duration in milliseconds
	Text          string     `json:"text,omitempty"`        // speech-to-text transcription from WeChat
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase voice fields.
func (v *VoiceItem) UnmarshalJSON(data []byte) error {
	var decoded struct {
		Media              *MediaInfo `json:"media,omitempty"`
		VoiceSize          int        `json:"voice_size,omitempty"`
		VoiceSizeCamel     int        `json:"voiceSize,omitempty"`
		EncodeType         int        `json:"encode_type,omitempty"`
		EncodeTypeCamel    int        `json:"encodeType,omitempty"`
		BitsPerSample      int        `json:"bits_per_sample,omitempty"`
		BitsPerSampleCamel int        `json:"bitsPerSample,omitempty"`
		SampleRate         int        `json:"sample_rate,omitempty"`
		SampleRateCamel    int        `json:"sampleRate,omitempty"`
		Playtime           int        `json:"playtime,omitempty"`
		Text               string     `json:"text,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	v.Media = decoded.Media
	v.VoiceSize = firstNonZero(decoded.VoiceSize, decoded.VoiceSizeCamel)
	v.EncodeType = firstNonZero(decoded.EncodeType, decoded.EncodeTypeCamel)
	v.BitsPerSample = firstNonZero(decoded.BitsPerSample, decoded.BitsPerSampleCamel)
	v.SampleRate = firstNonZero(decoded.SampleRate, decoded.SampleRateCamel)
	v.Playtime = decoded.Playtime
	v.Text = decoded.Text
	return nil
}

// ImageItem holds image content.
type ImageItem struct {
	URL     string     `json:"url,omitempty"`
	Media   *MediaInfo `json:"media,omitempty"`
	MidSize int        `json:"mid_size,omitempty"` // ciphertext size
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase image fields.
func (i *ImageItem) UnmarshalJSON(data []byte) error {
	var decoded struct {
		URL           string     `json:"url,omitempty"`
		ImageURL      string     `json:"image_url,omitempty"`
		ImageURLCamel string     `json:"imageUrl,omitempty"`
		Media         *MediaInfo `json:"media,omitempty"`
		MidSize       int        `json:"mid_size,omitempty"`
		MidSizeCamel  int        `json:"midSize,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	i.URL = firstNonEmpty(decoded.URL, decoded.ImageURL, decoded.ImageURLCamel)
	i.Media = decoded.Media
	i.MidSize = firstNonZero(decoded.MidSize, decoded.MidSizeCamel)
	return nil
}

// VideoItem holds video content.
type VideoItem struct {
	Media     *MediaInfo `json:"media,omitempty"`
	VideoSize int        `json:"video_size,omitempty"`
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase video fields.
func (v *VideoItem) UnmarshalJSON(data []byte) error {
	var decoded struct {
		Media          *MediaInfo `json:"media,omitempty"`
		VideoSize      int        `json:"video_size,omitempty"`
		VideoSizeCamel int        `json:"videoSize,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	v.Media = decoded.Media
	v.VideoSize = firstNonZero(decoded.VideoSize, decoded.VideoSizeCamel)
	return nil
}

// FileItem holds file content.
type FileItem struct {
	Media    *MediaInfo `json:"media,omitempty"`
	FileName string     `json:"file_name,omitempty"`
	Len      string     `json:"len,omitempty"` // plaintext size as string
}

// UnmarshalJSON accepts both iLink snake_case and observed camelCase file fields.
func (f *FileItem) UnmarshalJSON(data []byte) error {
	var decoded struct {
		Media         *MediaInfo `json:"media,omitempty"`
		FileName      string     `json:"file_name,omitempty"`
		FileNameCamel string     `json:"fileName,omitempty"`
		Len           string     `json:"len,omitempty"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	f.Media = decoded.Media
	f.FileName = firstNonEmpty(decoded.FileName, decoded.FileNameCamel)
	f.Len = decoded.Len
	return nil
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func firstNonZero(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

// SendMessageRequest is the body for sendmessage.
type SendMessageRequest struct {
	Msg      SendMsg  `json:"msg"`
	BaseInfo BaseInfo `json:"base_info"`
}

// SendMsg is the message payload for sending.
type SendMsg struct {
	FromUserID   string        `json:"from_user_id"`
	ToUserID     string        `json:"to_user_id"`
	ClientID     string        `json:"client_id"`
	MessageType  int           `json:"message_type"`
	MessageState int           `json:"message_state"`
	ItemList     []MessageItem `json:"item_list"`
	ContextToken string        `json:"context_token"`
}

// SendMessageResponse is the response from sendmessage.
type SendMessageResponse struct {
	Ret    int    `json:"ret"`
	ErrMsg string `json:"errmsg,omitempty"`
}

// Typing status constants.
const (
	TypingStatusTyping = 1
	TypingStatusCancel = 2
)

// GetConfigRequest is the body for getconfig.
type GetConfigRequest struct {
	ILinkUserID  string   `json:"ilink_user_id"`
	ContextToken string   `json:"context_token,omitempty"`
	BaseInfo     BaseInfo `json:"base_info"`
}

// GetConfigResponse is the response from getconfig.
type GetConfigResponse struct {
	Ret          int    `json:"ret"`
	ErrMsg       string `json:"errmsg,omitempty"`
	TypingTicket string `json:"typing_ticket,omitempty"`
}

// SendTypingRequest is the body for sendtyping.
type SendTypingRequest struct {
	ILinkUserID  string   `json:"ilink_user_id"`
	TypingTicket string   `json:"typing_ticket"`
	Status       int      `json:"status"`
	BaseInfo     BaseInfo `json:"base_info"`
}

// SendTypingResponse is the response from sendtyping.
type SendTypingResponse struct {
	Ret    int    `json:"ret"`
	ErrMsg string `json:"errmsg,omitempty"`
}
