# Изменения

## 0.2.8

- Windows installer with GitHub release checks after startup and every six hours; manual check in the title bar.
- Explicit download and restart actions, progress, retry after errors and confirmation before closing active SSH sessions or SFTP transfers.
- Standard electron-updater NSIS updates with SHA512 download integrity checks. Normal application exit does not install pending updates.
- Preserve the application identity, connection database and OS-encrypted passwords. Portable EXE/ZIP builds remain available with manual updates.
- Publish latest.yml and installer blockmap alongside the setup executable; add six updater regression tests.
- Verified an isolated installed 0.2.7 → 0.2.8 upgrade, corrupt-download rejection, cancellation, automatic restart and subsequent SSH authentication with an unchanged saved password.

## 0.2.7

- Preserve fitted terminal dimensions throughout SSH authentication and shell creation, fixing wrapped-command cursor movement into earlier output.
- Apply the same valid size range to initial PTY requests and subsequent resizes; refresh geometry after reconnect and defer fitting hidden tabs.
- Keep keystrokes after asynchronous clipboard reads in order: paste first, then arrows and typing. Canceled pastes and closed tabs discard pending input.
- Retain xterm bracketed paste, Russian/English clipboard shortcuts and confirmation starting at four explicit lines.
- Add regression tests for handshake/shell resize races and paste ordering, plus a packaged Linux SSH/Bash/readline integration check.


## 0.2.6

- Зашифрованный экспорт сохранённых паролей и секретных фраз ключей с отдельным паролем файла.
- AES-256-GCM и scrypt; имена и адреса серверов также зашифрованы.
- Импорт заново шифрует секреты системным хранилищем целевого компьютера.
- Проверка неверного пароля и повреждения файла, подтверждение импорта, пропуск дубликатов.
- Обычный экспорт без секретов сохранён; SSH-ключи, временные пароли, доверие к серверам и автоматический root не переносятся.

## 0.2.5

- Linux x64: DEB, AppImage и архив tar.gz с собственной иконкой.
- Сохранение паролей использует GNOME Keyring / KWallet; небезопасное хранилище basic_text запрещено.
- Автоматическая сборка и проверка запуска Linux в GitHub Actions.

## 0.2.4

- Новый графитово-оранжевый логотип и собственная многоразмерная Windows-иконка в EXE, заголовке и стартовом экране.
- Русский и английский интерфейс: формы, подсказки, диалоги доверия, подтверждения, SFTP и внутренние ошибки.
- Переключатель языка в меню подключений с сохранением выбора; открытые SSH-сессии продолжают работать.
- Пользовательские имена, команды, пути и вывод сервера не переводятся.
- Номер версии в заголовке берётся из package.json.

## 0.2.3

- Подтверждение вставки только от четырёх строк: явные LF/CRLF/CR; перенос по ширине окна не считается. Завершающий перевод строки не добавляет строку.
- TCP_NODELAY для немедленной отправки небольших SSH-пакетов с нажатиями клавиш. Задержка ответа удалённого сервера сохраняется.
- ZIP с распакованным приложением для быстрого запуска: распаковка один раз, затем запуск Amber SSH.exe из папки. Однофайловый portable EXE остаётся доступен.

## 0.2.2

- Копирование и вставка работают независимо от RU/ENG раскладки.
- Ctrl+V, Ctrl+Shift+V и ПКМ читают системный буфер Electron.
- Все способы многострочной вставки используют общий предпросмотр и подтверждение.
- Выделение копируется и после перехода фокуса на кнопки панели; поля форм сохраняют обычное поведение.
- Ctrl+F и Ctrl+K также не зависят от раскладки.

## 0.2.1

- Ctrl+C копирует выделение; без выделения прерывает команду.
- Копирование через системный буфер Electron вместо браузерного API.
- Автопрокрутка при выделении у верхнего и нижнего края терминала, с остановкой после отпускания мыши.

## 0.2.0

- Быстрый поиск подключений через Ctrl+K.
- Сохранённые команды с редактированием и подтверждением полного текста перед выполнением.
- Сохранение размера шрифта, положения и размера окна.
- Предпросмотр многострочной вставки из буфера.
- Импорт и экспорт подключений без секретов; сохранение существующих профилей.
- Панель SFTP: папки, загрузка, скачивание, прогресс, отмена и подтверждение замены файлов.

Сборка Windows x64 portable остаётся неподписанной. SFTP работает с правами SSH-пользователя. Поддерживается передача отдельных файлов.

## 0.1.2

- Переподключение в той же вкладке с сохранением терминального буфера.
- Обновление пароля после отказа SSH; сохранение только после успешного входа.
- Диалоги в общей теме и отмена по Escape.
